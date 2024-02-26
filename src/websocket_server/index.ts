import ws, { WebSocket } from 'ws';
import { Bot } from './bot';
import Game from './game';
import GamesController from './gamesController';
import { Connection, Ship, Winner } from './interfaces';
import Player from './player';
import Room from './room';
import RoomsController from './roomsController';
import { msgFromWSSHandler, updateWinners } from './util';

declare module 'ws' {
  export interface WebSocket extends ws {
    id: number;
  }
}

const connections = new Set<Connection>();
export const roomsController = new RoomsController();
const gamesController = new GamesController();
const players: Player[] = [];
let winners: Winner[] = [];

let wsIdx = 0;
let playerIdx = 0;
let roomIdx = 0;
let gameIdx = 0;
let shipIdx = 0;

const connectionHandler = (ws: WebSocket) => {
  ws.on('error', console.error);

  ws.on('message', (msg) => {
    const parsedMsg = JSON.parse(msg.toString());
    const msgType = parsedMsg.type;
    let msgData;
    if (parsedMsg.data) {
      msgData = JSON.parse(parsedMsg.data);
    }
    let name = '';
    let id = -1;
    let currentGameId: number;
    let attackerId: number;
    let player: Player;

    switch (msgType) {
      case 'reg': {
        name = msgData.name;
        const password = msgData.password;
        const existingPlayer = players.find((player) => player.username === name);
        let playerData = {};
        if (existingPlayer) {
          if (existingPlayer.password !== password) {
            playerData = {
              name: existingPlayer.username,
              index: existingPlayer.playerId,
              error: true,
              errorText: 'User already exists!',
            };
            ws.send(msgFromWSSHandler('reg', playerData));
          } else {
            playerData = {
              name,
              index: existingPlayer.playerId,
              error: false,
              errorText: '',
            };
            player = existingPlayer;
            connections.forEach((connection) => {
              if (connection.player === player) {
                connections.delete(connection);
              }
            });
            connections.add({ player, ws });
            ws.id = wsIdx;
            ws.send(msgFromWSSHandler('reg', playerData));
            ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
            ws.send(msgFromWSSHandler('update_winners', winners));
            wsIdx += 1;
          }
        } else {
          playerData = {
            name,
            index: playerIdx,
            error: false,
            errorText: '',
          };
          player = new Player(name, password, playerIdx);
          players.push(player);
          connections.add({ player, ws });
          ws.id = wsIdx;
          ws.send(msgFromWSSHandler('reg', playerData));
          ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
          ws.send(msgFromWSSHandler('update_winners', winners));
          wsIdx += 1;
          playerIdx += 1;
        }
        break;
      }

      case 'create_room': {
        connections.forEach((connection) => {
          if (ws.id === connection.ws.id) {
            name = connection.player.username;
            id = connection.player.playerId;
          }
        });
        const room = new Room(roomIdx, ws.id, name, id);
        roomsController.addRoom(room);
        connections.forEach((connection) => {
          connection.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
        });
        roomIdx += 1;
        break;
      }

      case 'add_user_to_room': {
        const roomId = msgData.indexRoom;
        const existingRoomUsername = roomsController.rooms.filter((room) => room.roomId === roomId)[0].roomUsers[0].name;

        connections.forEach((connection) => {
          if (ws.id === connection.ws.id) {
            name = connection.player.username;
            id = connection.player.playerId;
          }
        });

        if (existingRoomUsername === name) {
          return;
        }

        if (roomsController.rooms.find((room) => room.roomUsers[0].playerId === id)) {
          const rooomToDeleteId = roomsController.rooms.find((room) => room.roomUsers[0].playerId === id)!.roomId;

          roomsController.deleteRoomByRoomId(rooomToDeleteId);
        }

        roomsController.addUser(roomId, name, id);

        const oppId = roomsController.getCreatorId(roomId);
        const gameUserData = {
          idGame: gameIdx,
          idPlayer: id,
        };
        const gameOppData = {
          idGame: gameIdx,
          idPlayer: oppId,
        };

        connections.forEach((connection) => {
          if (connection.player.playerId === oppId) {
            connection.ws.send(msgFromWSSHandler('create_game', gameOppData));
          }

          if (connection.player.playerId === id) {
            connection.ws.send(msgFromWSSHandler('create_game', gameUserData));
          }
        });

        const gameId = gameIdx;
        gamesController.addGame(new Game(gameId, roomId));
        const roomsUpdated = roomsController.rooms.filter((room) => room.roomId !== roomId);
        roomsController.rooms = roomsUpdated;

        connections.forEach((connection) => {
          connection.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
        });
        gameIdx += 1;

        break;
      }

      case 'add_ships': {
        const gameId: number = msgData.gameId;
        const playerId: number = msgData.indexPlayer;
        const ships: Ship[] = msgData.ships;
        ships.forEach((ship) => {
          ship.shipId = shipIdx;
          shipIdx += 1;
        });
        shipIdx = 0;

        const game = gamesController.games.find((game) => game.gameId === gameId);
        game!.addShips(playerId, ships);

        if (game?.gameBoards.length === 2) {
          game.setTurn(game.gameBoards[0].currentPlayerIndex);
          connections.forEach((connection) => {
            if (!connection.bot && connection.player.playerId === game.gameBoards[0].currentPlayerIndex) {
              connection.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[0].ships, currentPlayerIndex: game.gameBoards[0].currentPlayerIndex }),
              );
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[0].currentPlayerIndex }));
            }

            if (!connection.bot && connection.player.playerId === game.gameBoards[1].currentPlayerIndex) {
              connection.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[1].ships, currentPlayerIndex: game.gameBoards[1].currentPlayerIndex }),
              );
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[0].currentPlayerIndex }));
            }

            if (connection.bot && connection.player.playerId === game.gameBoards[1].currentPlayerIndex) {
              game.setTurn(game.gameBoards[1].currentPlayerIndex);
              connection.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[1].ships, currentPlayerIndex: game.gameBoards[1].currentPlayerIndex }),
              );
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[1].currentPlayerIndex }));
              connection.bot.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[1].currentPlayerIndex }));
            }
          });
          game.gameBoards[0].ships = game.completeShips(game.gameBoards[0].ships);
          game.gameBoards[1].ships = game.completeShips(game.gameBoards[1].ships);
        }
        break;
      }

      case 'attack':
      case 'randomAttack': {
        currentGameId = msgData.gameId;
        attackerId = msgData.indexPlayer;
        gamesController.attack(currentGameId, attackerId, msgType, msgData, connections, winners, players);
        break;
      }

      case 'single_play': {
        const botId = playerIdx;
        const bot = new Bot('Bot', '', botId);
        playerIdx += 1;
        players.push(bot);

        connections.forEach((connection) => {
          if (ws.id === connection.ws.id) {
            name = connection.player.username;
            id = connection.player.playerId;
            connection.bot = bot;
          }
        });

        if (roomsController.rooms.find((room) => room.roomUsers[0].playerId === id)) {
          const rooomToDeleteId = roomsController.rooms.find((room) => room.roomUsers[0].playerId === id)!.roomId;

          roomsController.deleteRoomByRoomId(rooomToDeleteId);
        }

        connections.forEach((connection) => {
          connection.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
        });

        const gameUserData = {
          idGame: gameIdx,
          idPlayer: id,
        };

        const gameBotData = {
          idGame: gameIdx,
          idPlayer: botId,
        };

        const roomId = roomIdx;
        roomIdx += 1;
        const gameId = gameIdx;
        gameIdx += 1;

        const game = new Game(gameId, roomId);
        gamesController.addGame(game);

        bot.on('message', (message: string) => {
          const { type, data } = JSON.parse(message);
          if (type === 'add_ships') {
            const shipsData = JSON.parse(data);
            const ships = shipsData.ships;
            game.addShips(botId, ships);
          }
          if (type === 'attack') {
            const msgData = JSON.parse(data);
            gamesController.attack(gameId, botId, type, msgData, connections, winners, players);
          }
          if (type === 'delete_bot') {
            const msgData = JSON.parse(data);
            connections.forEach((connection) => {
              if (connection.bot && connection.bot.playerId === msgData) {
                delete connection.bot;
              }
            });
          }
        });

        connections.forEach((connection) => {
          if (connection.player.playerId === id) {
            connection.ws.send(msgFromWSSHandler('create_game', gameUserData));
            bot.send(msgFromWSSHandler('create_game', gameBotData));
          }
        });

        break;
      }
    }
  });

  ws.on('close', () => {
    let playerId: number;
    let game: Game | undefined;

    connections.forEach((connection) => {
      if (connection.ws.id === ws.id) {
        playerId = connection.player.playerId;
      }
    });

    connections.forEach((connection) => {
      if (connection.ws.id === ws.id) {
        connections.delete(connection);
      }
    });

    if (gamesController.games.length > 0) {
      try {
        game = gamesController.games.find(
          (game) => game.gameBoards[0]?.currentPlayerIndex === playerId || game.gameBoards[1]?.currentPlayerIndex === playerId,
        );
      } catch {
        game = gamesController.games.find((game) => game.currentTurn === -1);
        const gameId = game!.gameId;
        gamesController.deleteGame(gameId);
      }
    }

    if (game) {
      const gameId = game.gameId;
      const winPlayerId = game.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== playerId)[0].currentPlayerIndex;
      let winPlayerName = '';

      players.forEach((player) => {
        if (player.playerId === winPlayerId) {
          winPlayerName = player.username;
        }
      });

      winners = updateWinners(winners, winPlayerName);

      connections.forEach((connection) => {
        connection.ws.send(msgFromWSSHandler('update_winners', winners));

        if (connection.player.playerId === winPlayerId) {
          connection.ws.send(msgFromWSSHandler('finish', { winPlayer: winPlayerId }));
        }
      });

      gamesController.deleteGame(gameId);
    }

    roomsController.deleteRoomByWsId(ws.id);

    connections.forEach((connection) => {
      connection.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
    });
  });
};

export { connectionHandler };

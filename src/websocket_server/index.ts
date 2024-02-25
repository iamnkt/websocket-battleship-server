import ws, { WebSocket } from 'ws';
import Game from './game';
import GamesController from './gamesController';
import { Connection, Ship, Winner } from './interfaces';
import Player from './player';
import Room from './room';
import RoomsController from './roomsController';
import { msgFromWSSHandler } from './util';

declare module 'ws' {
  export interface WebSocket extends ws {
    id: number;
  }
}

const connections = new Set<Connection>();
const roomsController = new RoomsController();
const gamesController = new GamesController();
const players: Player[] = [];
const winners: Winner[] = [];

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
    let currentGame: Game;
    let attackedId: number;
    let attackedShips: Ship[];
    let attackedPos: Ship[];
    let openCells: string[];
    let remainingCells: string[];
    let x: number;
    let y: number;
    let pos: string;
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

        gamesController.addGame(new Game(gameIdx, roomId));
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
            if (connection.player.playerId === game.gameBoards[0].currentPlayerIndex) {
              connection.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[0].ships, currentPlayerIndex: game.gameBoards[0].currentPlayerIndex }),
              );
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[0].currentPlayerIndex }));
            }

            if (connection.player.playerId === game.gameBoards[1].currentPlayerIndex) {
              connection.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[1].ships, currentPlayerIndex: game.gameBoards[1].currentPlayerIndex }),
              );
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[0].currentPlayerIndex }));
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
        currentGame = gamesController.games.find((game) => game.gameId === currentGameId) as unknown as Game;
        attackedId = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].currentPlayerIndex;
        attackedShips = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].ships;
        openCells = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].openPositions;
        remainingCells = currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions;

        if (msgType === 'attack') {
          x = msgData.x;
          y = msgData.y;
          pos = '' + x + y;
        } else {
          const randomCell = Math.floor(Math.random() * remainingCells.length);
          pos = remainingCells[randomCell];
          x = +pos[0];
          y = +pos[1];
        }

        attackedPos = attackedShips.filter((ship) => Object.values(ship.position).join('') === pos);

        if (attackerId !== currentGame!.currentTurn) {
          return;
        }

        if (openCells.includes(pos)) {
          const currentTurn = currentGame.currentTurn;
          const turnReceiver = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== currentTurn)[0].currentPlayerIndex;
          connections.forEach((connection) => {
            if (connection.player.playerId === attackerId || connection.player.playerId === attackedId) {
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: turnReceiver }));
              currentGame!.setTurn(turnReceiver);
            }
          });
          return;
        }

        if (attackedPos.length === 0) {
          openCells.push(pos);
          currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions = remainingCells.filter(
            (cell) => !openCells.includes(cell),
          );
          connections.forEach((connection) => {
            if (connection.player.playerId === attackerId || connection.player.playerId === attackedId) {
              connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
              connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackedId }));
              currentGame!.setTurn(attackedId);
            }
          });
        } else {
          const result = currentGame!.removeHP(attackedId, pos);
          if (result === 'shot') {
            openCells.push(pos);
            currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions = remainingCells.filter(
              (cell) => !openCells.includes(cell),
            );
            connections.forEach((connection) => {
              if (connection.player.playerId === attackerId || connection.player.playerId === attackedId) {
                connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'shot' }));
                connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
                currentGame!.setTurn(attackerId);
              }
            });
          } else {
            const missPositions = currentGame!.checkForMissPositions(attackedId, pos);
            openCells.push(pos);
            currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions = remainingCells.filter(
              (cell) => !openCells.includes(cell),
            );
            connections.forEach((connection) => {
              if (connection.player.playerId === attackerId || connection.player.playerId === attackedId) {
                const killedShip = attackedShips.filter((ship) => ship.shipId === attackedPos[0].shipId);
                killedShip.forEach((ship) => {
                  const x = ship.position.x;
                  const y = ship.position.y;
                  connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'killed' }));
                });
                missPositions.forEach((pos) => {
                  openCells.push(pos);
                  const x = Number(pos[0]);
                  const y = Number(pos[1]);
                  connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
                });
                currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions =
                  remainingCells.filter((cell) => !openCells.includes(cell));
                connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
                currentGame!.setTurn(attackerId);
              }
            });
            currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === attackedId)[0].killEnemyShipsCount += 1;
            if (currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === attackedId)[0].killEnemyShipsCount === 10) {
              const winnerName = players.find((player) => player.playerId === attackerId)?.username as string;

              if (winners.find((winner) => winner.name === winnerName)) {
                winners.filter((winner) => winner.name === winnerName)[0].wins += 1;
              } else {
                winners.push({ name: winnerName, wins: 1 });
              }

              winners.sort((winner1: Winner, winner2: Winner) => winner2.wins - winner1.wins);

              connections.forEach((connection) => {
                connection.ws.send(msgFromWSSHandler('update_winners', winners));

                if (connection.player.playerId === attackerId || connection.player.playerId === attackedId) {
                  connection.ws.send(msgFromWSSHandler('finish', { winPlayer: attackerId }));
                  roomsController.deleteRoomByRoomId(currentGame.roomId);
                }
              });
            }
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    connections.forEach((connection) => {
      if (connection.ws.id === ws.id) {
        connections.delete(connection);
      }
    });

    roomsController.deleteRoomByWsId(ws.id);

    connections.forEach((connection) => {
      connection.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
    });
  });
};

export { connectionHandler };

import ws, { WebSocket } from 'ws';
import Game from './game';
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
const roomsController = new RoomsController(connections);
const players: Player[] = [];
const winners: Winner[] = [];
const games: Game[] = [];

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

    switch (msgType) {
      case 'reg': {
        name = msgData.name;
        const password = msgData.password;
        const existingPlayer = players.find((player) => player.username === name);
        let playerData = {};
        if (existingPlayer) {
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
            index: playerIdx,
            error: false,
            errorText: '',
          };
          const player = new Player(name, password, playerIdx);
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
        connections.forEach((conn) => {
          if (ws.id === conn.ws.id) {
            name = conn.player.username;
            id = conn.player.playerId;
          }
        });
        const room = new Room(roomIdx, name, id);
        roomsController.addRoom(room);
        ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
        roomIdx += 1;
        break;
      }

      case 'add_user_to_room': {
        const roomId = msgData.indexRoom;
        connections.forEach((conn) => {
          if (ws.id === conn.ws.id) {
            name = conn.player.username;
            id = conn.player.playerId;
          }
        });
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
        connections.forEach((conn) => {
          if (conn.player.playerId === oppId) {
            conn.ws.send(msgFromWSSHandler('create_game', gameOppData));
          }

          if (conn.player.playerId === id) {
            conn.ws.send(msgFromWSSHandler('create_game', gameUserData));
          }
        });
        games.push(new Game(gameIdx));
        const roomsUpdated = roomsController.rooms.filter((room) => room.roomId !== roomId);
        roomsController.rooms = roomsUpdated;
        connections.forEach((conn) => {
          conn.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
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

        const game = games.find((game) => game.gameId === gameId);
        game!.addShips(playerId, ships);
        if (game?.gameBoards.length === 2) {
          game.setTurn(game.gameBoards[0].currentPlayerIndex);
          connections.forEach((conn) => {
            if (conn.player.playerId === game.gameBoards[0].currentPlayerIndex) {
              conn.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[0].ships, currentPlayerIndex: game.gameBoards[0].currentPlayerIndex }),
              );
              conn.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[0].currentPlayerIndex }));
            }

            if (conn.player.playerId === game.gameBoards[1].currentPlayerIndex) {
              conn.ws.send(
                msgFromWSSHandler('start_game', { ships: game.gameBoards[1].ships, currentPlayerIndex: game.gameBoards[1].currentPlayerIndex }),
              );
              conn.ws.send(msgFromWSSHandler('turn', { currentPlayer: game.gameBoards[0].currentPlayerIndex }));
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
        currentGame = games.find((game) => game.gameId === currentGameId) as unknown as Game;
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
          connections.forEach((conn) => {
            if (conn.player.playerId === attackerId || conn.player.playerId === attackedId) {
              conn.ws.send(msgFromWSSHandler('turn', { currentPlayer: turnReceiver }));
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
          connections.forEach((conn) => {
            if (conn.player.playerId === attackerId || conn.player.playerId === attackedId) {
              conn.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
              conn.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackedId }));
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
            connections.forEach((conn) => {
              if (conn.player.playerId === attackerId || conn.player.playerId === attackedId) {
                conn.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'shot' }));
                conn.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
                currentGame!.setTurn(attackerId);
              }
            });
          } else {
            const missPositions = currentGame!.checkForMissPositions(attackedId, pos);
            openCells.push(pos);
            currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions = remainingCells.filter(
              (cell) => !openCells.includes(cell),
            );
            connections.forEach((conn) => {
              if (conn.player.playerId === attackerId || conn.player.playerId === attackedId) {
                conn.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'killed' }));
                missPositions.forEach((pos) => {
                  openCells.push(pos);
                  const x = Number(pos[0]);
                  const y = Number(pos[1]);
                  conn.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
                });
                currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions =
                  remainingCells.filter((cell) => !openCells.includes(cell));
                conn.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
                currentGame!.setTurn(attackerId);
              }
            });
            currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === attackedId)[0].killEnemyShipsCount += 1;
            if (currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === attackedId)[0].killEnemyShipsCount === 10) {
              connections.forEach((conn) => {
                if (conn.player.playerId === attackerId || conn.player.playerId === attackedId) {
                  conn.ws.send(msgFromWSSHandler('finish', { winPlayer: attackerId }));
                  currentGame!.setTurn(attackerId);
                }
              });
            }
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {});
};

export { connectionHandler };

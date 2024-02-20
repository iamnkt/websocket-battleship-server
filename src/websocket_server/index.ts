import ws, { WebSocket } from 'ws';
import Game from './game';
import { Connection, Winner } from './interfaces';
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
let player: Player;

const connectionHandler = (ws: WebSocket) => {
  ws.id = wsIdx;

  ws.on('error', console.error);  

  ws.on('message', (msg) => {
    const parsedMsg = JSON.parse(msg.toString());
    const msgType = parsedMsg.type
    let msgData;
    if (parsedMsg.data) {
      msgData = JSON.parse(parsedMsg.data);
    }
    let name = '';
    let id = 0;

    switch (msgType) {
      case 'reg':
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
          }
          ws.send(msgFromWSSHandler('reg', playerData));
        } else {
          playerData = {
            name,
            index: playerIdx,
            error: false,
            errorText: '',
          }
          const player = new Player(name, password, playerIdx);
          players.push(player);
          connections.add({ player, ws, wsId: wsIdx });
          ws.send(msgFromWSSHandler('reg', playerData));
          ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
          ws.send(msgFromWSSHandler('update_winners', winners));
          playerIdx += 1;
          wsIdx += 1;
        }
        break;
      case 'create_room':
        connections.forEach((conn) => {
          if (ws.id === conn.wsId) {
            name = conn.player.username;
            id = conn.player.playerId;
          }
        });
        const room = new Room(roomIdx, name, id);
        roomsController.addRoom(room);
        ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
        roomIdx += 1;
        break;
      case 'add_user_to_room':
        const roomId = msgData.indexRoom;
        connections.forEach((conn) => {
          if (ws.id === conn.wsId) {
            name = conn.player.username;
            id = conn.player.playerId;
          }
        });
        roomsController.addUser(roomId, name, id);
        const oppId = roomsController.getCreatorId(roomId);
        const gameUserData = {
          idGame: gameIdx,
          idPlayer: id,
        }
        const gameOppData = {
          idGame: gameIdx,
          idPlayer: oppId,
        }
        connections.forEach((conn) => {
          if (conn.player.playerId === id) {
            conn.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
            conn.ws.send(msgFromWSSHandler('create_game', gameUserData));
          }

          if (conn.player.playerId === oppId) {
            conn.ws.send(msgFromWSSHandler('update_room', roomsController.rooms));
            conn.ws.send(msgFromWSSHandler('create_game', gameOppData));
          }
        });
        games.push(new Game(gameIdx));
        const roomsUpdated = roomsController.rooms.filter((room) => room.roomId !== roomId);
        roomsController.rooms = roomsUpdated;
        gameIdx += 1;
        break;
      case 'add_ships':
        const gameId = msgData.gameId;
        const playerId = msgData.indexPlayer;
        const ships = msgData.ships;
        const game = games.find((game) => game.gameId === gameId);
        game?.addShips(playerId, ships);
        connections.forEach((conn) => {
          if (conn.player.playerId === playerId) {
            conn.ws.send(msgFromWSSHandler('start_game', { ships, currentPlayerIndex: playerId}));
          }
        });
        console.log(game);
        break;
      case 'start_game':
        break;
      case 'attack':
        break;
      case 'randomAttack':
        break;
      case 'turn':
        break;
      case 'finish':
        break;
    }
  });

  ws.on('close', () => {});
}

export { connectionHandler };

import Game from './game';
import { Connection, Winner } from './interfaces';
import Player from './player';
import { roomsController } from './index';
import { msgFromWSSHandler, updateWinners } from './util';

export default class GamesController {
  games: Game[];

  constructor() {
    this.games = [];
  }

  addGame(game: Game) {
    this.games.push(game);
  }

  deleteGame(gameId: number) {
    this.games = this.games.filter((game) => game.gameId !== gameId);
  }

  attack(gameId: number, attackerId: number, msgType: string, msgData: { gameId: number, x: number, y: number, indexPlayer: number }, connections: Set<Connection>, winners: Winner[], players: Player[]) {
    let x: number;
    let y: number;
    let pos: string;
    let currentGame = this.games.find((game) => game.gameId === gameId) as unknown as Game;
    let currentGameId = currentGame.gameId;
    let attackedId = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].currentPlayerIndex;
    let attackedShips = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].ships;
    let openCells = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].openPositions;
    let remainingCells = currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions;

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

    const attackedPos = attackedShips.filter((ship) => Object.values(ship.position).join('') === pos);

    if (attackerId !== currentGame!.currentTurn) {
      return;
    }

    if (openCells.includes(pos)) {
      const currentTurn = currentGame.currentTurn;
      const turnReceiver = currentGame.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== currentTurn)[0].currentPlayerIndex;
      connections.forEach((connection) => {
        if ((connection.player.playerId === attackerId && !connection.bot) || (connection.player.playerId === attackedId && !connection.bot)) {
          connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: turnReceiver }));
          currentGame!.setTurn(turnReceiver);
        }

        if ((connection.bot && connection.player.playerId === attackedId) || (connection.bot && connection.player.playerId === attackerId)) {
          connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: turnReceiver }));
          connection.bot.send(msgFromWSSHandler('turn', { currentPlayer: turnReceiver }));
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
        if ((connection.player.playerId === attackerId && !connection.bot) || (connection.player.playerId === attackedId && !connection.bot)) {
          connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
          connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackedId }));
          currentGame!.setTurn(attackedId);
        }

        if ((connection.bot && connection.player.playerId === attackedId) || (connection.bot && connection.player.playerId === attackerId)) {
          connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
          connection.bot.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
          currentGame!.setTurn(attackedId);
          connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackedId }));
          connection.bot.send(msgFromWSSHandler('turn', { currentPlayer: attackedId }));
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
          if ((connection.player.playerId === attackerId && !connection.bot) || (connection.player.playerId === attackedId && !connection.bot)) {
            connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'shot' }));
            connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
            currentGame!.setTurn(attackerId);
          }

          if ((connection.bot && connection.player.playerId === attackedId) || (connection.bot && connection.player.playerId === attackerId)) {
            connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'shot' }));
            connection.bot.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'shot' }));
            connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
            connection.bot.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
          }
        });
      } else {
        const missPositions = currentGame!.checkForMissPositions(attackedId, pos);
        openCells.push(pos);
        currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions = remainingCells.filter(
          (cell) => !openCells.includes(cell),
        );
        connections.forEach((connection) => {
          if ((connection.player.playerId === attackerId && !connection.bot) || (connection.player.playerId === attackedId && !connection.bot)) {
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

          if ((connection.bot && connection.player.playerId === attackedId) || (connection.bot && connection.player.playerId === attackerId)) {
            const killedShip = attackedShips.filter((ship) => ship.shipId === attackedPos[0].shipId);
            killedShip.forEach((ship) => {
              const x = ship.position.x;
              const y = ship.position.y;
              connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'killed' }));
              connection.bot?.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'killed' }));
            });
            missPositions.forEach((pos) => {
              openCells.push(pos);
              const x = Number(pos[0]);
              const y = Number(pos[1]);
              connection.ws.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
              connection.bot?.send(msgFromWSSHandler('attack', { position: { x: x, y: y }, currentPlayer: attackerId, status: 'miss' }));
            });
            currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex !== attackerId)[0].remainingPositions =
              remainingCells.filter((cell) => !openCells.includes(cell));
            connection.ws.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
            connection.bot.send(msgFromWSSHandler('turn', { currentPlayer: attackerId }));
            currentGame!.setTurn(attackerId);
          }
        });
        currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === attackedId)[0].killEnemyShipsCount += 1;
        if (currentGame!.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === attackedId)[0].killEnemyShipsCount === 10) {
          const winnerName = players.find((player) => player.playerId === attackerId)?.username as string;

          winners = updateWinners(winners, winnerName);

          connections.forEach((connection) => {
            connection.ws.send(msgFromWSSHandler('update_winners', winners));

            if ((connection.player.playerId === attackerId && !connection.bot) || (connection.player.playerId === attackedId && !connection.bot)) {
              connection.ws.send(msgFromWSSHandler('finish', { winPlayer: attackerId }));
              roomsController.deleteRoomByRoomId(currentGame.roomId);
            }

            if ((connection.bot && connection.player.playerId === attackedId) || (connection.bot && connection.player.playerId === attackerId)) {
              connection.ws.send(msgFromWSSHandler('finish', { winPlayer: attackerId }));
              connection.bot?.send(msgFromWSSHandler('finish', { winPlayer: attackerId }));
            }
          });

          this.deleteGame(currentGameId);
        }
      }
    }
  }
}

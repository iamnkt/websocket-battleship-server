import { GameBoard, Ship } from "./interfaces";

export default class Game {
  gameId: number;
  gameBoards: GameBoard[];

  constructor(gameId: number) {
    this.gameId = gameId;
    this.gameBoards = [];
  }

  addShips(playerId: number, ships: Ship[]) {
    this.gameBoards.push({
      currentPlayerIndex: playerId,
      ships,
    });
  }
}
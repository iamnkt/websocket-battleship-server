import Game from './game';

export default class GamesController {
  games: Game[];

  constructor() {
    this.games = [];
  }

  addGame(game: Game) {
    this.games.push(game);
  }
}

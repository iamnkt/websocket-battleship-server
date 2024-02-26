import { EventEmitter } from 'events';
import { makeBotShips } from './util';

const pos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export class Bot extends EventEmitter {
  username: string;
  playerId: number;
  password: string;
  botTurn: boolean;
  gameId: string;

  constructor(username: string, password: string, playerId: number) {
    super();
    this.username = username;
    this.playerId = playerId;
    this.password = password;
    this.botTurn = false;
    this.gameId = '';
  }

  handleMessage(msg: string): void {
    const { type, data } = JSON.parse(msg);

    switch (type) {
      case 'create_game': {
        this.gameId = JSON.parse(data).idGame;
        this.sendShips();
        break;
      }

      case 'turn': {
        const { currentPlayer } = JSON.parse(data);

        if (currentPlayer === this.playerId) {
          this.botTurn = true;
          setTimeout(() => {
            this.attack();
          }, 2000);
        } else {
          this.botTurn = false;
        }
        break;
      }

      case 'finish': {
        this.deleteBot();
        break;
      }
    }
  }

  sendShips(): void {
    const dataToSend = {
      gameId: this.gameId,
      indexPlayer: this.playerId,
      ships: makeBotShips(),
    };

    const msg = {
      type: 'add_ships',
      id: 0,
      data: JSON.stringify(dataToSend),
    };

    const message = JSON.stringify(msg);
    this.emit('message', message);
  }

  attack(): void {
    const randomX = Math.floor(Math.random() * pos.length);
    const x = pos[randomX];
    const randomY = Math.floor(Math.random() * pos.length);
    const y = pos[randomY];

    const dataToSend = {
      x,
      y,
      gameId: this.gameId,
      indexPlayer: this.playerId,
    };

    const msg = {
      type: 'attack',
      id: 0,
      data: JSON.stringify(dataToSend),
    };

    this.emit('message', JSON.stringify(msg));
  }

  deleteBot() {
    const msg = {
      type: 'delete_bot',
      id: 0,
      data: JSON.stringify(this.playerId),
    };
    this.emit('message', JSON.stringify(msg));
  }

  send(message: string): void {
    this.handleMessage(message);
  }
}
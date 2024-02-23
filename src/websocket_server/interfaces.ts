import { WebSocket } from 'ws';
import Player from './player';

export interface RoomPlayer {
  name: string;
  playerId: number;
}

export interface Connection {
  player: Player;
  ws: WebSocket;
}

export interface Winner {
  name: string;
  wins: number;
}

export interface Ship {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
  shipId: number;
}

export type Gameboard = {
  currentPlayerIndex: number;
  ships: Ship[];
  openPositions: string[];
  remainingPositions: string[];
  killEnemyShipsCount: number;
};

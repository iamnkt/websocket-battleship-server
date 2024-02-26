import { WebSocket } from 'ws';
import { Bot } from './bot';
import Player from './player';

export interface RoomPlayer {
  name: string;
  playerId: number;
}

export interface Connection {
  player: Player;
  ws: WebSocket;
  bot?: Bot;
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
  type: ShipType;
  shipId: number;
}

export type ShipType = 'small' | 'medium' | 'large' | 'huge';

export type Gameboard = {
  currentPlayerIndex: number;
  ships: Ship[];
  openPositions: string[];
  remainingPositions: string[];
  killEnemyShipsCount: number;
};

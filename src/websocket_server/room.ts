import { RoomPlayer, Ship } from './interfaces';

export default class Room {
  roomId: number;
  roomUsers: RoomPlayer[] = [];

  constructor(roomIdx: number, name: string, playerId: number) {
    this.roomId = roomIdx;
    this.roomUsers.push({
      name,
      playerId,
    });
  }
}
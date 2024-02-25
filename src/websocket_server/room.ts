import { RoomPlayer } from './interfaces';

export default class Room {
  roomId: number;
  createdByWsId: number;
  roomUsers: RoomPlayer[] = [];

  constructor(roomIdx: number, createdByWsId: number, name: string, playerId: number) {
    this.roomId = roomIdx;
    this.createdByWsId = createdByWsId;
    this.roomUsers.push({
      name,
      playerId,
    });
  }
}

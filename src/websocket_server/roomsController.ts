import Room from './room';

export default class RoomsController {
  rooms: Room[];

  constructor() {
    this.rooms = [];
  }

  addRoom(room: Room) {
    this.rooms.push(room);
  }

  addUser(roomId: number, name: string, playerId: number) {
    this.rooms.find((room) => room.roomId === roomId)?.roomUsers.push({ name, playerId });
  }

  getCreatorId(roomId: number) {
    const user = this.rooms.find((room) => room.roomId === roomId)?.roomUsers[0].playerId;
    return user;
  }

  deleteRoomByRoomId(roomId: number) {
    this.rooms = this.rooms.filter((room) => room.roomId !== roomId);
  }

  deleteRoomByWsId(wsId: number) {
    this.rooms = this.rooms.filter((room) => room.createdByWsId !== wsId);
  }
}

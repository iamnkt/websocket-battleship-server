export default class Player {
  username: string;
  password: string;
  playerId: number;

  constructor(username: string, password: string, playerId: number) {
    this.username = username;
    this.password = password;
    this.playerId = playerId;
  }


}

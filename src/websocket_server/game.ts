import { Gameboard, Ship } from './interfaces';
import { startPositions } from './util';
export default class Game {
  gameId: number;
  roomId: number;
  gameBoards: Gameboard[];
  currentTurn: number;

  constructor(gameId: number, roomId: number) {
    this.gameId = gameId;
    this.roomId = roomId;
    this.gameBoards = [];
    this.currentTurn = -1;
  }

  setTurn(playerId: number) {
    this.currentTurn = playerId;
  }

  addShips(playerId: number, ships: Ship[]) {
    this.gameBoards.push({
      currentPlayerIndex: playerId,
      ships,
      openPositions: [],
      remainingPositions: [...startPositions],
      killEnemyShipsCount: 0,
    });
  }

  updateShips(playerId: number, ships: Ship[]) {
    this.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === playerId)[0].ships = ships;
  }

  removeHP(playerId: number, pos: string) {
    const targetGameboard = this.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === playerId);
    const targetCell = targetGameboard[0].ships.filter((ship) => Object.values(ship.position).join('') === pos);
    const targetShipId = targetCell[0].shipId;
    let hp;

    targetGameboard[0].ships.forEach((ship) => {
      if (ship.shipId === targetShipId) {
        ship.length -= 1;
        hp = ship.length;
      }
    });

    this.updateShips(playerId, targetGameboard[0].ships);

    if (hp === 0) {
      return 'killed';
    } else {
      return 'shot';
    }
  }

  checkForMissPositions(playerId: number, pos: string) {
    const positions: string[] = [];
    const missPositions: string[] = [];
    const targetGameboard = this.gameBoards.filter((gameboard) => gameboard.currentPlayerIndex === playerId);
    const targetShips = targetGameboard[0].ships;
    const targetCell = targetShips.filter((ship) => Object.values(ship.position).join('') === pos);
    const targetShipId = targetCell[0].shipId;

    targetShips.forEach((ship) => {
      const positionString = Object.values(ship.position).join('');
      positions.push(positionString);
    });

    targetShips.forEach((ship) => {
      if (ship.shipId === targetShipId) {
        const x = ship.position.x;
        const y = ship.position.y;
        for (let i = x - 1; i <= x + 1; i += 1) {
          for (let j = y - 1; j <= y + 1; j += 1) {
            const position = { x: i, y: j };
            if (position.x >= 0 && position.x <= 9 && position.y >= 0 && position.y <= 9) {
              const positionsString = Object.values(position).join('');
              missPositions.push(positionsString);
            }
          }
        }
      }
    });

    return missPositions.filter((pos) => !positions.includes(pos));
  }

  completeShips(ships: Ship[]) {
    const remainingShipCells: Ship[] = [];

    ships.forEach((ship) => {
      const direction = ship.direction;
      const type = ship.type;
      const length = ship.length;
      const x = ship.position.x;
      const y = ship.position.y;
      const id = ship.shipId;
      let end;

      switch (ship.type) {
        case 'huge':
          if (direction === true) {
            end = y + 3;
            for (let i = y + 1; i <= end; i += 1) {
              remainingShipCells.push({
                position: { x: x, y: i },
                direction,
                type,
                length,
                shipId: id,
              });
            }
          } else {
            end = x + 3;
            for (let i = x + 1; i <= end; i += 1) {
              remainingShipCells.push({
                position: { x: i, y: y },
                direction,
                type,
                length,
                shipId: id,
              });
            }
          }
          break;

        case 'large':
          if (direction === true) {
            end = y + 2;
            for (let i = y + 1; i <= end; i += 1) {
              remainingShipCells.push({
                position: { x: x, y: i },
                direction,
                type,
                length,
                shipId: id,
              });
            }
          } else {
            end = x + 2;
            for (let i = x + 1; i <= end; i += 1) {
              remainingShipCells.push({
                position: { x: i, y: y },
                direction,
                type,
                length,
                shipId: id,
              });
            }
          }
          break;

        case 'medium':
          if (direction === true) {
            remainingShipCells.push({
              position: { x: x, y: y + 1 },
              direction,
              type,
              length,
              shipId: id,
            });
          } else {
            remainingShipCells.push({
              position: { x: x + 1, y: y },
              direction,
              type,
              length,
              shipId: id,
            });
          }
          break;
      }
    });

    return [...ships, ...remainingShipCells];
  }
}

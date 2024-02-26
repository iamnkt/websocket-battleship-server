import { Ship, ShipType, Winner } from './interfaces';

export const startPositions = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '69',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
  '77',
  '78',
  '79',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '97',
  '98',
  '99',
];

const msgFromWSSHandler = (type: string, data: object) => {
  return JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  });
};

const updateWinners = (winners: Winner[], winnerName: string): Winner[] => {
  if (winners.find((winner) => winner.name === winnerName)) {
    winners.filter((winner) => winner.name === winnerName)[0].wins += 1;
  } else {
    winners.push({ name: winnerName, wins: 1 });
  }

  winners.sort((winner1: Winner, winner2: Winner) => winner2.wins - winner1.wins);

  return winners;
};

const makeHuge = (direction: boolean, posX: number[], posY: number[]) => {
  let randomX: number;
  let randomY: number;
  let randomPosX: number;
  let randomPosY: number;

  if (direction) {
    randomX = Math.floor(Math.random() * posX.length);
    randomPosX = posX[randomX];

    randomY = Math.floor(Math.random() * posY.slice(0, 6).length);
    randomPosY = posY[randomY];
  } else {
    randomX = Math.floor(Math.random() * posX.slice(0, 6).length);
    randomPosX = posX[randomX];

    randomY = Math.floor(Math.random() * posY.length);
    randomPosY = posY[randomY];
  }

  return { x: randomPosX, y: randomPosY };
};

const makeLarge = (direction: boolean, posX: number[], posY: number[]) => {
  let randomX: number;
  let randomY: number;
  let randomPosX: number;
  let randomPosY: number;

  if (direction) {
    randomX = Math.floor(Math.random() * posX.length);
    randomPosX = posX[randomX];

    randomY = Math.floor(Math.random() * posY.slice(0, 7).length);
    randomPosY = posY[randomY];
  } else {
    randomX = Math.floor(Math.random() * posX.slice(0, 7).length);
    randomPosX = posX[randomX];

    randomY = Math.floor(Math.random() * posY.length);
    randomPosY = posY[randomY];
  }

  return { x: randomPosX, y: randomPosY };
};

const makeMedium = (direction: boolean, posX: number[], posY: number[]) => {
  let randomX: number;
  let randomY: number;
  let randomPosX: number;
  let randomPosY: number;

  if (direction) {
    randomX = Math.floor(Math.random() * posX.length);
    randomPosX = posX[randomX];

    randomY = Math.floor(Math.random() * posY.slice(0, 8).length);
    randomPosY = posY[randomY];
  } else {
    randomX = Math.floor(Math.random() * posX.slice(0, 8).length);
    randomPosX = posX[randomX];

    randomY = Math.floor(Math.random() * posY.length);
    randomPosY = posY[randomY];
  }

  return { x: randomPosX, y: randomPosY };
};

const makeSmall = (posX: number[], posY: number[]) => {
  const randomX = Math.floor(Math.random() * posX.length);
  const randomPosX = posX[randomX];

  const randomY = Math.floor(Math.random() * posY.length);
  const randomPosY = posY[randomY];

  return { x: randomPosX, y: randomPosY };
};

const checkForPositions = (type: string, direction: boolean, cells: string[], position: { x: number; y: number }): boolean => {
  let flag = 0;

  switch (type) {
    case 'large':
      if (direction) {
        for (let i = position.y; i <= position.y + 2; i += 1) {
          const posString = '' + position.x + i;
          if (cells.includes(posString)) {
            flag += 1;
          }
        }

        return flag === 3 ? true : false;
      } else {
        for (let i = position.x; i <= position.x + 2; i += 1) {
          const posString = '' + i + position.y;
          if (cells.includes(posString)) {
            flag += 1;
          }
        }

        return flag === 3 ? true : false;
      }

    case 'medium':
      if (direction) {
        for (let i = position.y; i <= position.y + 1; i += 1) {
          const posString = '' + position.x + i;
          if (cells.includes(posString)) {
            flag += 1;
          }
        }

        return flag === 2 ? true : false;
      } else {
        for (let i = position.x; i <= position.x + 1; i += 1) {
          const posString = '' + i + position.y;
          if (cells.includes(posString)) {
            flag += 1;
          }
        }

        return flag === 2 ? true : false;
      }

    case 'small': {
      const posString = '' + position.x + position.y;
      if (cells.includes(posString)) {
        flag += 1;
      }

      return flag === 1 ? true : false;
    }

    default:
      return false;
  }
};

const makeBotShips = (): Ship[] => {
  let cells = [...startPositions];
  const ships: Ship[] = [];
  const types: ShipType[] = ['huge', 'large', 'large', 'medium', 'medium', 'medium', 'small', 'small', 'small', 'small'];
  const posX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const posY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const directions = [false, true];
  let shipId = 0;

  types.forEach((type: ShipType) => {
    const randomDirection = Math.floor(Math.random() * directions.length);
    const direction = directions[randomDirection];
    let length = 0;
    let position: { x: number; y: number } = { x: -1, y: -1 };

    switch (type) {
      case 'huge':
        length = 4;
        position = makeHuge(direction, posX, posY);
        break;

      case 'large':
        length = 3;
        do {
          position = makeLarge(direction, posX, posY);
        } while (!checkForPositions('large', direction, cells, position));
        break;

      case 'medium':
        length = 2;
        do {
          position = makeMedium(direction, posX, posY);
        } while (!checkForPositions('medium', direction, cells, position));
        break;

      case 'small':
        length = 1;
        do {
          position = makeSmall(posX, posY);
        } while (!checkForPositions('small', direction, cells, position));
        break;
    }

    if (direction) {
      for (let i = position.x - 1; i <= position.x + 1; i += 1) {
        for (let j = position.y - 1; j <= position.y + length; j += 1) {
          cells = cells.filter((cell) => {
            return cell !== '' + i + j;
          });
        }
      }
    } else {
      for (let i = position.x - 1; i <= position.x + length; i += 1) {
        for (let j = position.y - 1; j <= position.y + 1; j += 1) {
          cells = cells.filter((cell) => {
            return cell !== '' + i + j;
          });
        }
      }
    }

    ships.push({
      position,
      direction,
      length: length,
      type,
      shipId: shipId++,
    });
  });

  return ships;
};

export { msgFromWSSHandler, updateWinners, makeBotShips };

const msgFromWSSHandler = (type: string, data: object) => {
  return JSON.stringify({
    type,
    data: JSON.stringify(data),
  })
};

export { msgFromWSSHandler };

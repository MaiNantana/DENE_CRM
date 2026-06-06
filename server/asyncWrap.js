/** wrap async route handler ให้ forward error ไปที่ Express error middleware */
export const aw = fn => (req, res, next) => fn(req, res, next).catch(next);

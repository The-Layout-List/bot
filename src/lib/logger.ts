import path from "node:path";
import log4js from "log4js";

log4js.configure(path.resolve(process.cwd(), "log4js.json"));

export const logger = log4js.getLogger();
export const sqlLogger = log4js.getLogger("sql");
export const errorLogger = log4js.getLogger("error");

export default logger;

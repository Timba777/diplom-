"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = require("./app");
dotenv_1.default.config();
const PORT = process.env.PORT || 4000;
app_1.app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

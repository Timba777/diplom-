import dotenv from "dotenv";
import { app } from "./app";

// Force load `.env` so `PORT` isn't overridden by external environment variables.
dotenv.config({ override: true });

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});


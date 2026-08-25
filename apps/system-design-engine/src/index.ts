import "dotenv/config";
import { app } from "./app";

const port = process.env.PORT || 3002;

app.listen(port, () => {
  console.log(`System Design Engine is running on port ${port} (Express)`);
});

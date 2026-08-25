import express, { type Express } from "express";
import cors from "cors";
import { routes } from "./routes";

export const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("System Design Engine is running!");
});

app.use(routes);

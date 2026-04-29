import express from "express";
import { config } from "dotenv";
import { limiter } from "./middlewares/rateLimit";
import { router } from "./routes/routes";

config(); // dotenv

const app = express();
const PORT = process.env.PORT ?? 3001;

// middlewares
app.use(limiter);

// static files (only used in local development)
app.use(express.static("public"));

// router
app.use("/", router);

// Only listen if not running on Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`⚔️  API started ON PORT : ${PORT} @ STARTED  ⚔️`);
    });
}

export default app;

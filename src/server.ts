import express from "express";
import { config } from "dotenv";
import { limiter } from "./middlewares/rateLimit";
import { router } from "./routes/routes";
import path from "path";
import fs from "fs";

config();

const app = express();
const PORT = process.env.PORT ?? 3001;
const APP_VERSION = "1.2.0"; // 👈 CHANGE THIS ONE TIME TO UPDATE EVERYTHING

// Middleware to inject versioning into HTML files automatically
app.get("/*.html", (req, res, next) => {
    const filePath = path.join(__dirname, "../public", req.path);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, "utf8");
        // Automatically replace any asset links with the current version
        content = content.replace(/href="style.css[^"]*"/g, `href="style.css?v=${APP_VERSION}"`);
        content = content.replace(/src="script.js[^"]*"/g, `src="script.js?v=${APP_VERSION}"`);
        content = content.replace(/src="app.js[^"]*"/g, `src="app.js?v=${APP_VERSION}"`);
        return res.send(content);
    }
    next();
});

// Serve the main index.html for the root path with versioning
app.get("/", (req, res) => {
    const filePath = path.join(__dirname, "../public/index.html");
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(/href="style.css[^"]*"/g, `href="style.css?v=${APP_VERSION}"`);
    content = content.replace(/src="script.js[^"]*"/g, `src="script.js?v=${APP_VERSION}"`);
    return res.send(content);
});

app.use(limiter);
app.use(express.static("public"));
app.use("/", router);

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`⚔️  API started ON PORT : ${PORT} @ STARTED  ⚔️`);
        console.log(`🏷️  Current Version: ${APP_VERSION}`);
    });
}

export default app;

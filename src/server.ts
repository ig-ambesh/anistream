import express from "express";
import { config } from "dotenv";
import { limiter } from "./middlewares/rateLimit";
import { router } from "./routes/routes";
import path from "path";
import fs from "fs";

config();

const app = express();
const PORT = process.env.PORT ?? 3001;
const APP_VERSION = "1.3.0"; 

// Use process.cwd() for reliable paths on Vercel
const PUBLIC_DIR = path.join(process.cwd(), "public");

// Middleware to inject versioning into HTML files automatically
app.get("/*.html", (req, res, next) => {
    const fileName = req.path === "/" ? "index.html" : req.path;
    const filePath = path.join(PUBLIC_DIR, fileName);
    
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, "utf8");
        content = content.replace(/href="style.css[^"]*"/g, `href="style.css?v=${APP_VERSION}"`);
        content = content.replace(/src="script.js[^"]*"/g, `src="script.js?v=${APP_VERSION}"`);
        content = content.replace(/src="app.js[^"]*"/g, `src="app.js?v=${APP_VERSION}"`);
        return res.send(content);
    }
    next();
});

// Serve the main index.html for the root path
app.get("/", (req, res) => {
    const filePath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, "utf8");
        content = content.replace(/href="style.css[^"]*"/g, `href="style.css?v=${APP_VERSION}"`);
        content = content.replace(/src="script.js[^"]*"/g, `src="script.js?v=${APP_VERSION}"`);
        return res.send(content);
    }
    res.status(404).send("Index not found");
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

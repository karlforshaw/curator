const electron = require("electron");
const fs = require("fs");
const url = require("url");
const path = require("path");
const csv = require("csv");
const neatCsv = require("neat-csv");
const csvStringify = require("csv-stringify");
const execSync = require('child_process').execSync;

const {app, dialog, BrowserWindow, Menu, ipcMain} = electron;

let openGameDbPath;

let mainWindow;
let files = [];

function createWindow() {

    mainWindow = new BrowserWindow({
        height: 600, width: 800,
        webPreferences: {
            "nodeIntegration": true
        }
    }); 

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'main.html'),
        protocol: 'file:',
        slashes:true
    })).catch(console.error);
}


async function getFiles(path) {

    const dir = await fs.promises.opendir(path);
    files = [];

    for await (const dirent of dir) {
        if (dirent.name.indexOf("csv") > -1)
            files.push(dirent.name);
    }

    return files;
}



async function getFile(path) {
    let contents;

    const file = await fs.promises.readFile(path);
    const parsed = await neatCsv(file);

    return parsed;
}



app.whenReady().then(() => {

    openGameDbPath = dialog.showOpenDialogSync({
        properties: ['openDirectory'],
        title: "Select the OpenGameDB Folder"})[0];

    console.log(openGameDbPath);

    createWindow();

    ipcMain.on("wantFiles", (event, messages) => {
        getFiles(openGameDbPath)
            .then((files)=>{
                event.sender.send("wantFiles", files);
            })
            .catch(console.error);

    });

    ipcMain.on("wantContents", (event, path) => {

        getFile(openGameDbPath + "/" + path)
            .then((lines)=>{
                event.sender.send("wantContents", lines);
            })
            .catch(console.error);

    });

    ipcMain.on("save", (event, file, row, game) => {

        console.log(file + ":" + row);
        let input = [
            game.title ? game.title.trim(): '',
            game.released ? game.released.trim() : '',
            game.gf_score ? game.gf_score.trim() : '',
            game.metascore? game.metascore.trim() : '',
            game.genre ? game.genre.trim() : '',
            game.description ? game.description.trim() : '',
            game.cover_art_url ? game.cover_art_url.trim() : ''
            ];

        if (game.id)
            input.push(game.id);

        csvStringify([input], 
            function (error, output) {

                if (error) console.error("err: ", error);

                let path = openGameDbPath + "/" + file;
                command = "sed -Ei '"+row + " c\\" + output.replace(/"/g,'\\"').replace(/'/g, "\\x27") + "' " + path;
                code = execSync(command);

                event.sender.send("save");
            });

    });
});



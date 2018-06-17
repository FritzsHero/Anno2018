import FileSystem from "./filesystem";
import GAMParser from "./parsers/GAM/gam-parser";
import GameRenderer from "./game/game-renderer";

export default class Menu {
    constructor(private fs: FileSystem, private gamParser: GAMParser,
                private gameRenderer: GameRenderer) { }

    async render() {
        const menu = document.body.appendChild(document.createElement('div'));

        console.table(await this.fs.ls('/saves'));

        for (const saveGame of await this.fs.ls('/saves')) {
            const title = document.createElement('p');
            title.innerText = saveGame.name;
            title.onclick = async () => {
                const saveGameData = await this.fs.openAndGetContentAsStream(saveGame);
                const map = await this.gamParser.parse(saveGameData);
                await this.gameRenderer.render(map);
            };
            menu.appendChild(title);
        }
    }
}
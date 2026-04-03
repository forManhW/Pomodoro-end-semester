import '../seed/seed.js';
import './style.css';
import Header from "../components/Header/Header";
import Settings from "../components/Settings/Settings";
import Spotify from "../components/Spotify/Spotify";
import Agent from "../components/Agent/Agent";

const header = new Header();
const settings = new Settings();
new Spotify();
new Agent();


header.setSettings(settings);

import '../../shared/style.css';
import './settings.css';
import Header from '../../components/Header/Header';
import Settings from '../../components/Settings/Settings';

const header = new Header();
const settings = new Settings(document.querySelector('main'));
header.setSettings(settings);

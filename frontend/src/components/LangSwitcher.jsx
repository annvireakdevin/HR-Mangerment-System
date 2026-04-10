import { useTranslation } from 'react-i18next';

export default function LangSwitcher({ variant = 'sidebar' }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('km') ? 'km' : 'en';

  const toggle = (lang) => {
    i18n.changeLanguage(lang);
  };

  if (variant === 'login') {
    return (
      <div className="lang-switcher-login">
        <button
          className={`lang-btn ${current === 'en' ? 'active' : ''}`}
          onClick={() => toggle('en')}
        >EN</button>
        <span className="lang-divider">|</span>
        <button
          className={`lang-btn ${current === 'km' ? 'active' : ''}`}
          onClick={() => toggle('km')}
        >ខ្មែរ</button>
      </div>
    );
  }

  return (
    <div className="lang-switcher">
      <button
        className={`lang-btn ${current === 'en' ? 'active' : ''}`}
        onClick={() => toggle('en')}
      >EN</button>
      <button
        className={`lang-btn ${current === 'km' ? 'active' : ''}`}
        onClick={() => toggle('km')}
      >ខ្មែរ</button>
    </div>
  );
}

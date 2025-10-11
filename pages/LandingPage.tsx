
import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

const sampleCovers = [
  { title: 'השראה לסלון', subtitle: 'תבניות נקיות', img: 'https://picsum.photos/seed/salon/400/500' },
  { title: 'אמנות ועיצוב', subtitle: 'אסתטיקה מודרנית', img: 'https://picsum.photos/seed/art/400/500' },
  { title: 'טיולים ופנאי', subtitle: 'בלילות של קיץ', img: 'https://picsum.photos/seed/travel/400/500' },
  { title: 'עולם הטכנולוגיה', subtitle: 'מהדורה 2024', img: 'https://picsum.photos/seed/tech/400/500' },
];

const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#111827]">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4">
          איחולן
        </h1>
        <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
          הסיפור שלך, בעיצוב מרתק. <br/> עצבו שערי מגזין מדהימים שימסגרו את הרגע הייחודי שלכם.
        </p>
        <Link
          to="/templates"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full text-lg transition duration-300 transform hover:scale-105"
        >
          התחל עיצוב
        </Link>
        <div className="mt-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {sampleCovers.map((cover, index) => (
              <div key={index} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
                <img src={cover.img} alt={cover.title} className="w-full h-64 object-cover" />
                <div className="p-4">
                  <h3 className="text-lg font-bold">{cover.title}</h3>
                  <p className="text-sm text-slate-400">{cover.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-slate-400">
        <p>&copy; 2024 איחולן. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
};

export default LandingPage;

import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LineChart, User, LogOut } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-700 transition-colors">
                                <LineChart className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-xl text-gray-900 tracking-tight">EDINET Analysis</span>
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        {user ? (
                            <>
                                <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                                    ダッシュボード
                                </Link>
                                <Link to="/analysis" className="text-gray-600 hover:text-blue-600 font-medium transition-colors bg-blue-50 px-3 py-1 rounded-md">
                                    分析手法を作る
                                </Link>
                                <Link to="/portfolios" className="text-gray-600 hover:text-blue-600 font-medium transition-colors bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md">
                                    ポートフォリオ
                                </Link>
                                <div className="h-6 w-px bg-gray-200"></div>
                                <div className="flex items-center gap-2 text-gray-700 font-medium">
                                    <User className="w-4 h-4" />
                                    <span>{user.username}</span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                                    title="ログアウト"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                                    ログイン
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                                >
                                    新規登録
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

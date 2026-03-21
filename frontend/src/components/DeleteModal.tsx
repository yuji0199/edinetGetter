import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DeleteModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, title, message, onClose, onConfirm }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div 
                className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold mb-4 text-gray-900">{title}</h3>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfirm(); }}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                    >
                        削除する
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default DeleteModal;

import React from 'react';
import { motion } from 'framer-motion';
import emptyImage from '../../assets/not found/communication-removebg-preview.png';

export default function EmptyState({ message = 'No data available at the moment.', subMessage = 'Please check back later.' }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-16 text-center"
    >
      <img 
        src={emptyImage} 
        alt="No data available" 
        className="w-64 h-64 object-contain opacity-80 mb-6 drop-shadow-2xl"
      />
      <h3 className="text-2xl font-bold text-white mb-2">{message}</h3>
      <p className="text-gray-400">{subMessage}</p>
    </motion.div>
  );
}

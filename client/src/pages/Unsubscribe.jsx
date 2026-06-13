import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

const Unsubscribe = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Processing your request...');

  useEffect(() => {
    const processUnsubscribe = async () => {
      try {
        const response = await api.get(`/subscribe/unsubscribe/${token}`);
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message);
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Invalid or expired unsubscribe link.');
      }
    };

    if (token) {
      processUnsubscribe();
    } else {
      setStatus('error');
      setMessage('Unsubscribe token is missing.');
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 md:p-12 rounded-3xl max-w-md w-full text-center border border-app-border relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-hover" />
        
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <h2 className="text-2xl font-heading font-black text-app-text mb-2">Please wait</h2>
            <p className="text-app-text-muted">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
            <h2 className="text-2xl font-heading font-black text-app-text mb-4">Successfully Unsubscribed</h2>
            <p className="text-app-text-muted mb-8 leading-relaxed">
              {message} We're sorry to see you go. If you ever change your mind, you can always subscribe again from our blog page.
            </p>
            <Link 
              to="/blog"
              className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-black font-bold px-8 py-3 rounded-lg transition-all duration-300 w-full"
            >
              Return to Blog
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="w-20 h-20 text-red-500 mb-6" />
            <h2 className="text-2xl font-heading font-black text-app-text mb-4">Unsubscribe Failed</h2>
            <p className="text-app-text-muted mb-8 leading-relaxed">
              {message}
            </p>
            <Link 
              to="/"
              className="bg-app-card border border-app-border text-app-text hover:bg-app-card-hover font-bold px-8 py-3 rounded-lg transition-all duration-300 w-full"
            >
              Go to Home
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Unsubscribe;

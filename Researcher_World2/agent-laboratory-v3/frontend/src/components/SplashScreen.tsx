import React, { useState, useRef, useCallback } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [videoFadeOut, setVideoFadeOut] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAttempt, setVideoAttempt] = useState(0);

  // Transizione alla schermata principale
  const startTransition = useCallback(() => {
    setVideoFadeOut(true);
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 300);
    }, 500);
  }, [onComplete]);

  // L'utente clicca "Avvia": il video parte con audio (il click soddisfa la browser policy)
  const handleStart = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    videoRef.current.play()
      .then(() => {
        setVideoStarted(true);
        setIsMuted(false);
      })
      .catch(() => {
        // Fallback estremo: parti muto
        videoRef.current!.muted = true;
        videoRef.current!.play().then(() => {
          setVideoStarted(true);
          setIsMuted(true);
        }).catch(() => {});
      });
  }, []);

  // Toggle mute/unmute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // Errore video: prova video alternativo
  const handleVideoError = () => {
    if (videoAttempt === 0 && videoRef.current) {
      setVideoAttempt(1);
      videoRef.current.src = "assets/video/MBO-FedPixel_VideoAnimation.mp4";
      videoRef.current.load();
    }
  };

  // Fine video: transizione automatica all'app
  const handleVideoEnded = () => {
    window.dispatchEvent(new CustomEvent('videoSplashEnded'));
    startTransition();
  };

  if (!isVisible) return null;

  return (
    <div className={`splash-screen ${videoFadeOut ? 'fade-out' : ''}`}>
      <div className="video-container">
        <video
          id="splash-video"
          ref={videoRef}
          className="splash-video"
          playsInline
          preload="auto"
          onError={handleVideoError}
          onEnded={handleVideoEnded}
        >
          <source src="assets/video/splash-intro.mp4" type="video/mp4" />
        </video>

        {/* Schermata iniziale: pulsante Avvia (necessario per browser audio policy) */}
        {!videoStarted && (
          <div className="splash-start-overlay">
            <h2>Agent Laboratory</h2>
            <p>Federated Generative Agents</p>
            <button className="start-button" onClick={handleStart}>
              Avvia
            </button>
          </div>
        )}

        {/* Pulsante mute/unmute durante la riproduzione */}
        {videoStarted && (
          <button
            className="unmute-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
          >
            <span className="icon">{isMuted ? '🔇' : '🔊'}</span>
            <span className="text">{isMuted ? 'Attiva Audio' : 'Disattiva Audio'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SplashScreen;

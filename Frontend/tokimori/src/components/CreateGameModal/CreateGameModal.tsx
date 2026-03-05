import { useState } from 'react';
import styles from './CreateGameModal.module.css';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, image?: File) => Promise<void>;
  isLoading: boolean;
}

export const CreateGameModal = ({ isOpen, onClose, onSubmit, isLoading }: CreateGameModalProps) => {
  const [gameName, setGameName] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!gameName.trim()) {
      setError('El nombre del juego es requerido');
      return;
    }

    try {
      await onSubmit(gameName, selectedImage);
      setGameName('');
      setSelectedImage(undefined);
      setPreviewUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el juego');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crear Nuevo Juego</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="gameName" className={styles.label}>
              Nombre del Juego *
            </label>
            <input
              id="gameName"
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Ingrese el nombre del juego"
              className={styles.input}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="gameImage" className={styles.label}>
              Imagen del Juego
            </label>
            <input
              id="gameImage"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className={styles.fileInput}
              disabled={isLoading}
            />
            {previewUrl && (
              <div className={styles.imagePreview}>
                <img src={previewUrl} alt="Vista previa" />
              </div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? 'Creando...' : 'Crear Juego'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

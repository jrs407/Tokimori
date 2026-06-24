import { useState } from 'react';
import styles from './CreateGameModal.module.css';

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, image?: File) => Promise<void>;
  isLoading: boolean;
}

export const CreateItemModal = ({ isOpen, onClose, onSubmit, isLoading }: CreateItemModalProps) => {
  const [itemName, setItemName] = useState('');
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

    if (!itemName.trim()) {
      setError('El nombre del elemento es requerido');
      return;
    }

    try {
      await onSubmit(itemName, selectedImage);
      setItemName('');
      setSelectedImage(undefined);
      setPreviewUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el elemento');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crear Nuevo Elemento</h2>
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
            <label htmlFor="itemName" className={styles.label}>
              Nombre del Elemento *
            </label>
            <input
              id="itemName"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ingrese el nombre del elemento"
              className={styles.input}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="itemImage" className={styles.label}>
              Imagen del Elemento
            </label>
            <input
              id="itemImage"
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
              {isLoading ? 'Creando...' : 'Crear Elemento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import numpy as np
import pickle
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences


MODEL_PATH = 'predictions/models/page5.2.h5'
NAME_TOKENIZER_PATH = 'predictions/models/tokenizer_name.pickle'
PUBLISHER_TOKENIZER_PATH = 'predictions/models/tokenizer_publisher.pickle'
MAX_SEQ_LENGTH = 100


class ItemsPagesPredictor:
    def __init__(self,
                 model_path: str = MODEL_PATH,
                 name_tokenizer_path: str = NAME_TOKENIZER_PATH,
                 publisher_tokenizer_path: str = PUBLISHER_TOKENIZER_PATH,
                 max_seq_length: int = MAX_SEQ_LENGTH):
        self.model = load_model(model_path)
        with open(name_tokenizer_path, 'rb') as tokenizer_file:
            self.name_tokenizer = pickle.load(tokenizer_file)
        with open(publisher_tokenizer_path, 'rb') as tokenizer_file:
            self.publisher_tokenizer = pickle.load(tokenizer_file)
        self.max_seq_length = max_seq_length

    def predict(self,
                name: str,
                year: int,
                issue: int,
                publisher: str) -> float:

        name_seq = self.name_tokenizer.texts_to_sequences([name])
        publisher_seq = \
            self.publisher_tokenizer.texts_to_sequences([publisher])

        name_seq_padded = pad_sequences(name_seq, maxlen=self.max_seq_length)
        publisher_seq_padded = pad_sequences(
            publisher_seq, maxlen=self.max_seq_length
        )

        input_data = np.concatenate((
            name_seq_padded,
            publisher_seq_padded,
            np.array([[issue]]),
            np.array([[year]])
            ), axis=1)

        prediction = self.model.predict(input_data)
        return float(prediction[0][0])

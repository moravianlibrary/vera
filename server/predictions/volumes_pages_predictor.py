import numpy as np
import pickle
from tensorflow.keras.saving import load_model
from tensorflow.keras.utils import pad_sequences
from typing import List


MODEL_PATH = 'predictions/models/page5.2.h5'
NAME_TOKENIZER_PATH = 'predictions/models/tokenizer_name.pickle'
PUBLISHER_TOKENIZER_PATH = 'predictions/models/tokenizer_publisher.pickle'
MAX_SEQ_LENGTH = 100


class VolumesPagesPredictor:
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
                issues_count: int,
                publishers: List[str]) -> float:

        name_seq = self.name_tokenizer.texts_to_sequences([name])
        publisher_seq = \
            self.publisher_tokenizer.texts_to_sequences(publishers)

        name_seq_padded = pad_sequences(name_seq, maxlen=self.max_seq_length)
        publisher_seq_padded = pad_sequences(
            publisher_seq, maxlen=self.max_seq_length
        )

        result = 0.0
        for issue_number in range(1, issues_count + 1):
            input_data = np.concatenate((
                name_seq_padded,
                publisher_seq_padded,
                np.array([[issue_number]]),
                np.array([[year]])
                ), axis=1)

            prediction = self.model.predict(input_data)
            result += float(prediction[0][0])

        return result

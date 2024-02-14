import numpy as np
from tensorflow.keras.saving import load_model
from tensorflow.keras.utils import pad_sequences
from tensorflow.keras.layers import TextVectorization
from pandas import DataFrame


MODEL_PATH = 'predictions/models/perio.h5'
NAME_TOKENIZER_PATH = 'predictions/models/tokenizer_name.npy'
PUBLISHER_TOKENIZER_PATH = 'predictions/models/tokenizer_publisher.npy'
ORIGIN_TOKENIZER_PATH = 'predictions/models/tokenizer_origin.npy'
LANG_TOKENIZER_PATH = 'predictions/models/tokenizer_lang.npy'
MAX_SEQ_LENGTH = 100


class VolumesPagesPredictor:
    def __init__(self,
                 model_path: str = MODEL_PATH,
                 name_tokenizer_path: str = NAME_TOKENIZER_PATH,
                 publisher_tokenizer_path: str = PUBLISHER_TOKENIZER_PATH,
                 origin_tokenizer_path: str = ORIGIN_TOKENIZER_PATH,
                 lang_tokenizer_path: str = LANG_TOKENIZER_PATH,
                 max_seq_length: int = MAX_SEQ_LENGTH):
        self.model = load_model(model_path)
        self.max_seq_length = max_seq_length

        self.tokenizer_name = self.load_tokenizer(name_tokenizer_path)
        self.tokenizer_publisher = self.load_tokenizer(
            publisher_tokenizer_path)
        self.tokenizer_origin = self.load_tokenizer(origin_tokenizer_path)
        self.tokenizer_lang = self.load_tokenizer(lang_tokenizer_path)

    def load_tokenizer(self, tokenizer_path):
        tokenizer_config = np.load(tokenizer_path, allow_pickle=True).item()
        tokenizer = TextVectorization.from_config(tokenizer_config)
        return tokenizer

    def predict(self,
                name: str,
                year: int,
                frequency: int,
                publisher: str,
                origin: str,
                language: str) -> float:
        df = DataFrame({
            'name': [name],
            'publisher': [publisher],
            'origin': [origin],
            'lang': [language],
            'year': [year],
            'freq': [frequency]
        })
        self.tokenizer_name.adapt(df['name'])
        self.tokenizer_publisher.adapt(df['publisher'])
        self.tokenizer_origin.adapt(df['origin'])
        self.tokenizer_lang.adapt(df['lang'])

        X_name = pad_sequences(
            self.tokenizer_name(df['name']).numpy(),
            maxlen=100, padding='post', truncating='post'
        )
        X_publisher = pad_sequences(
            self.tokenizer_publisher(df['publisher']).numpy(),
            maxlen=100, padding='post', truncating='post'
        )
        X_origin = pad_sequences(
            self.tokenizer_origin(df['origin']).numpy(),
            maxlen=100, padding='post', truncating='post'
        )
        X_lang = pad_sequences(
            self.tokenizer_lang(df['lang']).numpy(),
            maxlen=100, padding='post', truncating='post'
        )
        X_year = df['year'].to_numpy().reshape(-1, 1)
        X_freq = df['freq'].to_numpy().reshape(-1, 1)

        X_input_doc = np.concatenate(
            [X_name, X_publisher, X_year, X_origin, X_lang, X_freq], axis=1)

        pages_prediction = self.model.predict(X_input_doc)
        return float(pages_prediction[0][0])

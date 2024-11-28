import unittest
from schemas import Frequency
from services.parsers.frequency_parser import (
    parse_frequency,
    parse_year,
)


class TestFrequencyParser(unittest.TestCase):
    def setUp(self):
        self.frequencies = [
            Frequency(date="2023-2024", frequency="Biweekly"),
            Frequency(date="2022", frequency="jednou měsíčně"),
            Frequency(date="2020-2021", frequency="1x ročně"),
            Frequency(date="2019", frequency="Aktualizováno čtvrtletně"),
            Frequency(date="2018", frequency="denně"),
            Frequency(date="2017", frequency="Vychází nepravidelně"),
            Frequency(date="2016", frequency="Bimonthly"),
            Frequency(date="2015", frequency="týdeník"),
            Frequency(date="2014", frequency="deník"),
            Frequency(date="2013", frequency="Vychází nepravidelně"),
            Frequency(date="2012", frequency="Periodicita není známa"),
        ]

    def test_parse_year_valid_single(self):
        self.assertEqual(parse_year("2020"), 2020)

    def test_parse_year_valid_range(self):
        self.assertEqual(parse_year("2020-2021"), 2020)

    def test_parse_year_invalid(self):
        with self.assertRaises(ValueError):
            parse_year("Invalid year")

    def test_parse_frequency_no_match(self):
        self.assertEqual(parse_frequency("2025", self.frequencies), 6)

    def test_parse_yearly_frequency(self):
        self.assertEqual(parse_frequency("2020", self.frequencies), 1)

    def test_parse_yearly_frequency_for_range(self):
        self.assertEqual(parse_frequency("2020-2021", self.frequencies), 1)

    def test_parse_monthly_frequency(self):
        self.assertEqual(parse_frequency("2022", self.frequencies), 12)

    def test_parse_iregular_frequency(self):
        self.assertEqual(parse_frequency("2017", self.frequencies), 0)

    def test_parse_bimonthly_frequency(self):
        self.assertEqual(parse_frequency("2016", self.frequencies), 6)

    def test_parse_frequency_to_x_weekly(self):
        self.assertEqual(parse_frequency("2015", self.frequencies), 52)

    def test_parse_frequency_to_x_daily(self):
        self.assertEqual(parse_frequency("2014", self.frequencies), 365)

    def test_parse_frequency_to_x_non_regular(self):
        self.assertEqual(parse_frequency("2013", self.frequencies), 0)

    def test_parse_frequency_to_x_unknown(self):
        self.assertEqual(parse_frequency("2012", self.frequencies), 0)

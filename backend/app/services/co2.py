"""Tailpipe CO₂ of driving the same distance.

Walking and biking count as 0 g for the trip. The driving figure is the
US EPA average gasoline car: 404 g/mile, which is 251 g/km.
"""

CAR_G_PER_KM = 251


def trip_co2_g() -> float:
    return 0


def driving_co2_g(distance_meters: float) -> float:
    return round((distance_meters / 1000) * CAR_G_PER_KM, 1)

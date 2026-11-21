"""CO2 of driving the same distance.

Walking and biking count as 0 g. Driving uses 251 g/km
(US EPA average gasoline car, 404 g per mile).
"""

CAR_G_PER_KM = 251


def trip_co2_g() -> float:
    return 0


def driving_co2_g(distance_meters: float) -> float:
    return round((distance_meters / 1000) * CAR_G_PER_KM, 1)

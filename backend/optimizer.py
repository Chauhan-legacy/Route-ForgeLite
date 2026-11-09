"""
RouteForge - Advanced Route Optimization Engine
Zero Paid APIs - 100% Free Open Data.

Features:
- Google OR-Tools Guided Local Search Metaheuristic (TSP)
- Open-Ended TSP formulation using dummy zero-cost sink node
- Fixed Start / Fixed End / Round Trip / Open-Ended TSP support
- OSRM Road Distance & Duration Matrix with Haversine fallback
- Constrained 2-Opt Local Search respecting locked invariant stops
- Exact Before/After Comparison and Honest Reporting
"""
import math
import time
import urllib.request
import json
from typing import List, Dict, Any, Optional, Tuple

EARTH_RADIUS_METERS = 6371000.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    if lat1 == lat2 and lon1 == lon2:
        return 0.0
    to_rad = math.pi / 180.0
    d_lat = (lat2 - lat1) * to_rad
    d_lon = (lon2 - lon1) * to_rad
    phi1 = lat1 * to_rad
    phi2 = lat2 * to_rad

    a = math.sin(d_lat / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return EARTH_RADIUS_METERS * c

def stop_distance(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    lat_a = a.get("latitude") if a.get("latitude") is not None else a.get("lat")
    lon_a = a.get("longitude") if a.get("longitude") is not None else a.get("lng")
    lat_b = b.get("latitude") if b.get("latitude") is not None else b.get("lat")
    lon_b = b.get("longitude") if b.get("longitude") is not None else b.get("lng")

    if lat_a is None or lon_a is None or lat_b is None or lon_b is None:
        return 0.0
    return haversine_distance(float(lat_a), float(lon_a), float(lat_b), float(lon_b))

def normalize_options(raw_options: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    opts = raw_options or {}
    return {
        "fixedStart": bool(opts.get("fixedStart", opts.get("fixStart", True))),
        "fixedEnd": bool(opts.get("fixedEnd", opts.get("fixEnd", False))),
        "returnToStart": bool(opts.get("returnToStart", False)),
        "lockedStops": bool(opts.get("lockedStops", True)),
        "objective": str(opts.get("objective", "distance")).lower(),
    }

def build_haversine_matrix(stops: List[Dict[str, Any]]) -> List[List[int]]:
    n = len(stops)
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(0)
            else:
                row.append(int(round(stop_distance(stops[i], stops[j]))))
        matrix.append(row)
    return matrix

def fetch_road_matrix(stops: List[Dict[str, Any]], objective: str = "distance") -> Tuple[List[List[int]], str]:
    """
    Attempts to fetch real road network distance/duration matrix from OSRM.
    Falls back to Haversine great-circle distance matrix if OSRM is unreachable or stops > 100.
    """
    n = len(stops)
    if n < 2 or n > 100:
        return build_haversine_matrix(stops), "Haversine Euclidean Matrix"

    # Extract coordinates
    coords_parts = []
    for s in stops:
        lat = s.get("latitude") if s.get("latitude") is not None else s.get("lat")
        lng = s.get("longitude") if s.get("longitude") is not None else s.get("lng")
        if lat is None or lng is None:
            return build_haversine_matrix(stops), "Haversine Euclidean Matrix"
        coords_parts.append(f"{float(lng):.6f},{float(lat):.6f}")

    coords_str = ";".join(coords_parts)
    url = f"https://router.project-osrm.org/table/v1/driving/{coords_str}?annotations=distance,duration"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "RouteForge/2.0 (High Precision Road Matrix; contact@routeforge.local)",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("code") == "Ok":
                    table_key = "durations" if objective == "duration" and "durations" in data else "distances"
                    raw_table = data.get(table_key)
                    if raw_table and len(raw_table) == n:
                        int_matrix = []
                        for i in range(n):
                            row = []
                            for j in range(n):
                                if i == j:
                                    row.append(0)
                                else:
                                    val = raw_table[i][j]
                                    if val is None or val < 0:
                                        val = int(round(stop_distance(stops[i], stops[j])))
                                    else:
                                        val = int(round(val))
                                    row.append(val)
                            int_matrix.append(row)
                        return int_matrix, f"OSRM Road Network {table_key.capitalize()} Matrix"
    except Exception:
        pass

    return build_haversine_matrix(stops), "Haversine Great-Circle Matrix (Fallback)"

def _stop_key(s: Any, idx: int = 0) -> str:
    if isinstance(s, dict):
        return str(s.get("stopId") or s.get("id") or f"idx_{idx}")
    return str(s)

def calculate_tour_distance(tour: List[Dict[str, Any]], matrix: Optional[List[List[int]]] = None, original_stops: Optional[List[Dict[str, Any]]] = None, return_to_start: bool = False) -> float:
    n = len(tour)
    if n < 2:
        return 0.0

    if matrix is not None and original_stops is not None and len(matrix) == len(original_stops):
        stop_to_idx = {_stop_key(original_stops[k], k): k for k in range(len(original_stops))}
        total = 0.0
        for i in range(n - 1):
            u_key = _stop_key(tour[i], i)
            v_key = _stop_key(tour[i + 1], i + 1)
            u = stop_to_idx.get(u_key)
            v = stop_to_idx.get(v_key)
            if u is not None and v is not None:
                total += matrix[u][v]
            else:
                total += stop_distance(tour[i], tour[i + 1])
        if return_to_start and n > 2:
            u_key = _stop_key(tour[-1], n - 1)
            v_key = _stop_key(tour[0], 0)
            u = stop_to_idx.get(u_key)
            v = stop_to_idx.get(v_key)
            if u is not None and v is not None:
                total += matrix[u][v]
            else:
                total += stop_distance(tour[-1], tour[0])
        return float(total)

    total = 0.0
    for i in range(n - 1):
        total += stop_distance(tour[i], tour[i + 1])
    if return_to_start and n > 2:
        total += stop_distance(tour[-1], tour[0])
    return total

def solve_ortools_tsp(stops: List[Dict[str, Any]], options: Dict[str, Any], matrix: List[List[int]]) -> Optional[List[Dict[str, Any]]]:
    """
    Solves TSP using Google OR-Tools Routing Model with Guided Local Search.
    Properly models:
    - Fixed Start + Fixed End
    - Fixed Start + Open End (Open-Ended TSP using an unweighted dummy sink node)
    - Round-Trip (Return to Start)
    """
    try:
        from ortools.constraint_solver import routing_enums_pb2
        from ortools.constraint_solver import pywrapcp
    except Exception:
        return None

    n = len(stops)
    if n < 3 or n > 250:
        return None

    # Check for inner locked stops (between index 1 and n-2)
    has_inner_locks = False
    for idx, s in enumerate(stops):
        if idx not in (0, n - 1):
            if (s.get("metadata") or {}).get("locked"):
                has_inner_locks = True
                break
    if has_inner_locks:
        return None

    fixed_start = options.get("fixedStart", True)
    fixed_end = options.get("fixedEnd", False)
    return_to_start = options.get("returnToStart", False)

    # 1. Closed Circuit (Round-trip)
    if return_to_start:
        manager = pywrapcp.RoutingIndexManager(n, 1, 0)
        eval_matrix = matrix
        dummy_sink_node = None

    # 2. Fixed Start & Fixed End
    elif fixed_start and fixed_end:
        manager = pywrapcp.RoutingIndexManager(n, 1, [0], [n - 1])
        eval_matrix = matrix
        dummy_sink_node = None

    # 3. Open-Ended TSP (Fixed Start, Open End):
    # Add a dummy sink node at index N. Every real node can reach dummy sink with cost 0.
    # The dummy sink cannot reach any real node.
    elif fixed_start and not fixed_end:
        dummy_sink_node = n
        eval_matrix = []
        for i in range(n):
            row = list(matrix[i])
            row.append(0)  # Cost from real stop i to dummy sink is 0
            eval_matrix.append(row)
        # Dummy sink row: huge cost to any real stop (cannot leave sink)
        eval_matrix.append([100000000] * n + [0])
        manager = pywrapcp.RoutingIndexManager(n + 1, 1, [0], [dummy_sink_node])

    # 4. Open-Start and Open-End:
    else:
        dummy_depot_node = n
        eval_matrix = []
        for i in range(n):
            row = list(matrix[i])
            row.append(0)
            eval_matrix.append(row)
        eval_matrix.append([0] * (n + 1))
        manager = pywrapcp.RoutingIndexManager(n + 1, 1, dummy_depot_node)
        dummy_sink_node = dummy_depot_node

    try:
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return eval_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = 1

        solution = routing.SolveWithParameters(search_parameters)
        if not solution:
            return None

        index = routing.Start(0)
        route_indices = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node < n:  # Exclude dummy sink / depot
                route_indices.append(node)
            index = solution.Value(routing.NextVar(index))

        # Check for unvisited stops
        if len(route_indices) < n:
            visited = set(route_indices)
            for idx in range(n):
                if idx not in visited:
                    route_indices.append(idx)

        return [stops[idx] for idx in route_indices]

    except Exception:
        return None

def nearest_neighbor_construction(stops: List[Dict[str, Any]], options: Dict[str, Any], matrix: List[List[int]], original_stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    n = len(stops)
    if n <= 2:
        return list(stops)

    result: List[Optional[Dict[str, Any]]] = [None] * n
    used = set()

    fixed_start = options.get("fixedStart", True)
    fixed_end = options.get("fixedEnd", False)
    locked_stops = options.get("lockedStops", True)

    # Pre-place locked invariants
    for i in range(n):
        is_locked = (fixed_start and i == 0) or \
                    (fixed_end and i == n - 1) or \
                    (locked_stops and (stops[i].get("metadata") or {}).get("locked"))
        if is_locked:
            result[i] = stops[i]
            used.add(stops[i].get("stopId") or i)

    if result[0] is None:
        result[0] = stops[0]
        used.add(stops[0].get("stopId") or 0)

    stop_to_idx = {_stop_key(original_stops[k], k): k for k in range(len(original_stops))}
    unplaced = [s for s in stops if _stop_key(s) not in used]
    current = result[0]

    for i in range(1, n):
        if result[i] is not None:
            current = result[i]
            continue
        if not unplaced:
            break

        cur_idx = stop_to_idx[_stop_key(current)]
        best_cost = float("inf")
        best_idx = -1

        for j, cand in enumerate(unplaced):
            cand_idx = stop_to_idx[_stop_key(cand)]
            cost = matrix[cur_idx][cand_idx]
            if cost < best_cost:
                best_cost = cost
                best_idx = j

        if best_idx >= 0:
            chosen = unplaced.pop(best_idx)
            result[i] = chosen
            current = chosen

    for i in range(n):
        if result[i] is None and unplaced:
            result[i] = unplaced.pop(0)

    return [s for s in result if s is not None]

def two_opt_optimization(stops: List[Dict[str, Any]], options: Dict[str, Any], matrix: List[List[int]], original_stops: List[Dict[str, Any]], max_iterations: int = 200) -> List[Dict[str, Any]]:
    current_tour = list(stops)
    n = len(current_tour)
    if n <= 3:
        return current_tour

    stop_to_idx = {_stop_key(original_stops[k], k): k for k in range(len(original_stops))}
    start_idx = 1 if options.get("fixedStart", True) else 0
    end_idx = n - 2 if options.get("fixedEnd", False) else n - 1
    return_to_start = options.get("returnToStart", False)
    locked_stops = options.get("lockedStops", True)

    improved = True
    iterations = 0

    while improved and iterations < max_iterations:
        improved = False
        iterations += 1

        for i in range(start_idx, end_idx):
            for j in range(i + 1, end_idx + 1):
                # Verify segment contains no locked stops
                if locked_stops:
                    has_locked = any((current_tour[k].get("metadata") or {}).get("locked") for k in range(i, j + 1))
                    if has_locked:
                        continue

                prev_stop = current_tour[i - 1] if i > 0 else (current_tour[-1] if return_to_start else None)
                next_stop = current_tour[j + 1] if j < n - 1 else (current_tour[0] if return_to_start else None)

                u_cur_i = stop_to_idx[_stop_key(current_tour[i], i)]
                u_cur_j = stop_to_idx[_stop_key(current_tour[j], j)]
                u_prev = stop_to_idx[_stop_key(prev_stop)] if prev_stop else None
                u_next = stop_to_idx[_stop_key(next_stop)] if next_stop else None

                cur_cost = 0
                new_cost = 0

                if u_prev is not None:
                    cur_cost += matrix[u_prev][u_cur_i]
                    new_cost += matrix[u_prev][u_cur_j]

                if u_next is not None:
                    cur_cost += matrix[u_cur_j][u_next]
                    new_cost += matrix[u_cur_i][u_next]

                if new_cost < cur_cost - 1:
                    current_tour[i:j + 1] = list(reversed(current_tour[i:j + 1]))
                    improved = True
                    break
            if improved:
                break

    return current_tour

def optimize_stops(stops: List[Dict[str, Any]], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    start_perf = time.perf_counter()
    n = len(stops)
    clean_opts = normalize_options(options)

    if n <= 2:
        dist = calculate_tour_distance(stops, return_to_start=clean_opts["returnToStart"])
        analytics = {
            "executionTimeMs": 0.4,
            "algorithm": "Direct Sequence (< 3 stops)",
            "matrixProvider": "Direct Line",
            "fuelSavedLiters": 0.0,
            "co2SavedKg": 0.0,
            "timeSavedMinutes": 0.0,
            "costSavedEst": 0.0,
            "circuityRatio": 1.0,
            "longestLegMeters": round(dist),
            "averageLegMeters": round(dist),
            "lockedStopsPreserved": n,
        }
        return {
            "originalDistanceMeters": round(dist),
            "optimizedDistanceMeters": round(dist),
            "savingsMeters": 0,
            "savingsPercent": 0.0,
            "method": "Direct Sequence (< 3 stops)",
            "isGloballyOptimal": True,
            "isAlreadyOptimal": True,
            "targetStops": n,
            "stops": [dict(s, sequence=idx) for idx, s in enumerate(stops)],
            "analytics": analytics,
            "beforeAfter": {
                "originalDistanceMeters": round(dist),
                "optimizedDistanceMeters": round(dist),
                "savingsMeters": 0,
                "savingsPercent": 0.0,
                "isAlreadyOptimal": True,
                "analytics": analytics,
            }
        }

    # 1. Fetch real road distance/duration matrix (or Haversine fallback)
    matrix, matrix_provider = fetch_road_matrix(stops, objective=clean_opts["objective"])

    # 2. Compute true baseline distance for current sequence using the matrix
    original_dist = calculate_tour_distance(stops, matrix=matrix, original_stops=stops, return_to_start=clean_opts["returnToStart"])
    method_used = "Nearest-Neighbor + 2-Opt Constrained Local Search"

    # 3. Solve with Google OR-Tools Guided Local Search if eligible
    candidate_tour = None
    if n <= 150:
        candidate_tour = solve_ortools_tsp(stops, clean_opts, matrix)
        if candidate_tour:
            method_used = f"Google OR-Tools Guided Local Search ({matrix_provider})"

    # 4. Fallback to Nearest-Neighbor + 2-Opt if OR-Tools cannot run or stops have inner locks
    if not candidate_tour:
        nn_tour = nearest_neighbor_construction(stops, clean_opts, matrix, original_stops=stops)
        candidate_tour = two_opt_optimization(nn_tour, clean_opts, matrix, original_stops=stops)
        method_used = f"Nearest-Neighbor + 2-Opt ({matrix_provider})"

    # 5. Measure candidate distance using the exact same matrix
    candidate_dist = calculate_tour_distance(candidate_tour, matrix=matrix, original_stops=stops, return_to_start=clean_opts["returnToStart"])

    # 6. Verify improvement
    is_already_optimal = False
    if candidate_dist < original_dist - 1:
        final_tour = candidate_tour
        final_dist = candidate_dist
        savings_meters = original_dist - final_dist
        savings_percent = (savings_meters / original_dist * 100.0) if original_dist > 0 else 0.0
    else:
        # Route is already optimal or candidate yielded no improvement
        final_tour = list(stops)
        final_dist = original_dist
        savings_meters = 0.0
        savings_percent = 0.0
        is_already_optimal = True

    exec_time_ms = round((time.perf_counter() - start_perf) * 1000.0, 1)

    # Compute leg breakdown & statistics
    stop_to_idx = {_stop_key(stops[k], k): k for k in range(len(stops))}
    longest_leg = 0
    total_legs = max(1, len(final_tour) - 1)
    for i in range(len(final_tour) - 1):
        u = stop_to_idx.get(_stop_key(final_tour[i], i), i)
        v = stop_to_idx.get(_stop_key(final_tour[i+1], i+1), i+1)
        leg_len = matrix[u][v]
        if leg_len > longest_leg:
            longest_leg = leg_len

    avg_leg = round(final_dist / total_legs)

    # Calculate straight-line Euclidean distance between final stops for circuity ratio
    straight_line_dist = 0.0
    for i in range(len(final_tour) - 1):
        straight_line_dist += stop_distance(final_tour[i], final_tour[i+1])
    circuity = round(final_dist / max(1.0, straight_line_dist), 2) if straight_line_dist > 0 else 1.0

    # Environmental & Economic savings metrics
    fuel_saved = round((savings_meters / 1000.0) * 0.085, 2)  # 8.5L / 100km
    co2_saved = round((savings_meters / 1000.0) * 0.196, 2)   # 196g CO2 / km
    time_saved = round((savings_meters / 1000.0) / 40.0 * 60.0, 1) # at 40 km/h
    cost_saved = round(fuel_saved * 1.45, 2) # est $1.45 / L

    locked_count = sum(1 for s in final_tour if (s.get("metadata") or {}).get("locked"))
    if clean_opts["fixedStart"]:
        locked_count += 1
    if clean_opts["fixedEnd"] and len(final_tour) > 1:
        locked_count += 1

    analytics = {
        "executionTimeMs": exec_time_ms,
        "algorithm": method_used,
        "matrixProvider": matrix_provider,
        "fuelSavedLiters": fuel_saved,
        "co2SavedKg": co2_saved,
        "timeSavedMinutes": time_saved,
        "costSavedEst": cost_saved,
        "circuityRatio": circuity,
        "longestLegMeters": longest_leg,
        "averageLegMeters": avg_leg,
        "lockedStopsPreserved": locked_count,
    }

    res_stops = []
    for idx, s in enumerate(final_tour):
        sc = dict(s)
        sc["sequence"] = idx
        res_stops.append(sc)

    return {
        "originalDistanceMeters": round(original_dist),
        "optimizedDistanceMeters": round(final_dist),
        "savingsMeters": round(savings_meters),
        "savingsPercent": round(savings_percent, 2),
        "method": method_used,
        "isGloballyOptimal": False,
        "isAlreadyOptimal": is_already_optimal,
        "targetStops": n,
        "stops": res_stops,
        "analytics": analytics,
        "beforeAfter": {
            "originalDistanceMeters": round(original_dist),
            "optimizedDistanceMeters": round(final_dist),
            "savingsMeters": round(savings_meters),
            "savingsPercent": round(savings_percent, 2),
            "isAlreadyOptimal": is_already_optimal,
            "analytics": analytics,
        }
    }

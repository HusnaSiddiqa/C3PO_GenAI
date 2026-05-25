from sqlglot import exp, parse_one

def wrap_query_with_count(sql_string: str):
    expression = parse_one(sql_string, read="databricks")

    with_clause = expression.find(exp.With)

    main_body = expression.copy()
    main_body.set("with", None)

    count_expression = (
        exp.select("COUNT(*) as num_rows")
        .from_(main_body.subquery(alias="main_result"))
    )

    if with_clause:
        cte_node = with_clause.copy()
        count_expression.set("with", cte_node)

    return count_expression.sql(dialect="databricks")


def wrap_query_with_limit(sql_string: str, limit_value: int):
    parsed = parse_one(sql_string, dialect="databricks")

    wrapped = (
        exp.select("*")
        .from_(parsed.subquery(alias="t"))
        .limit(limit_value)
    )

    return wrapped.sql(dialect="databricks")


def wrap_query_with_insert(sql_string: str, insert_clause: str):
    parsed = parse_one(sql_string, dialect="databricks")

    without_cte = parsed.copy()
    for with_clause in without_cte.find_all(exp.With):
        with_clause.pop()

    with_clause = parsed.find(exp.With)

    final_sql = (
        (with_clause.copy().sql(dialect="databricks") if with_clause else '') +
        insert_clause +
        without_cte.sql(dialect="databricks")
    )

    return final_sql

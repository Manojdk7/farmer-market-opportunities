def calculate_net_proceeds(q, p, l, d, ct, ch, cp, cm, co):
    """
    Formula from PDF: N = Q(1-L)(P-D) - CT - CH - CP - CM - CO
    Q: Quantity, P: Price, L: Physical loss, D: Quality deduction
    CT: Transport, CH: Handling, CP: Packaging, CM: Market/Commission, CO: Other
    """
    if q <= 0 or p <= 0:
        return 0.0
    
    # Calculate saleable quantity
    saleable_qty = q * (1 - l)
    
    # Calculate effective price after quality deductions
    effective_price = max(0, p - d)
    
    # Gross revenue
    gross_revenue = saleable_qty * effective_price
    
    # Total costs
    total_costs = ct + ch + cp + cm + co
    
    # Net proceeds
    net_proceeds = gross_revenue - total_costs
    return net_proceeds
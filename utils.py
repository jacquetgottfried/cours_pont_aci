def print_matrix_join(matrix):
    # Loop over each row
    for row in matrix:
        # Convert each element to a string and join with spaces
        print(' '.join(map(str, row)))
        
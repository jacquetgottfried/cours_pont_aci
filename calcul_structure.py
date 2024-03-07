import math

import numpy as np


def quantite_eal(E, A, L):
    return E*A/L

def quantite_eil(E, I, L):
    return E*I/L

def quantite_eil2(E, I, L):
    return (E*I)/(L*L)

def quantite_eil3(E, I, L):
    return (E*I)/(L*L*L)

def matrice_elementaire(E, I, A, L):
    eal =  quantite_eal(E, A, L)
    eil = quantite_eil(E, I, L)
    eil2 = quantite_eil2(E, I, L)
    eil3 = quantite_eil3(E, I, L)

    k_elem = np.array([
        [eal,    0,      0,      -eal,   0,      0],
        [0,  12*eil3,    6*eil2, 0,     -12*eil3, 6*eil2],
        [0,     6*eil2,  4*eil,  0,     -6*eil2, 2*eil],
        [-eal,  0,       0,      eal,   0,       0],
        [0, -12*eil3,   -6*eil2, 0,     12*eil3, -6*eil2],
        [0, 6*eil2,     2*eil,   0,     -6*eil2, 4*eil],
    ], dtype=float)


    return k_elem

def rotation_matrice(theta):
    _lambda = np.array([
        [math.cos(theta),   math.sin(theta),    0,      0,      0,  0],
        [-math.sin(theta),  math.cos(theta),    0,      0,      0,  0],
        [0,  0, 1, 0, 0, 0],
        [0, 0,  0, math.cos(theta),   math.sin(theta),    0],
        [0, 0, 0, -math.sin(theta),  math.cos(theta), 0],
        [0, 0, 0,  0, 0, 1],
    ], dtype=float)

    return _lambda

def element_matrice(LM):
    LM = np.array(LM).astype(int)
    return LM

def equation_matrice(EQ):
    EQ = np.array(EQ).astype(int)
    return EQ

def assemblage_matrice_rigidite(LM, element, K_global, mat_elem_global):
    indice = LM[:, element]!=0
    identity_matrix = np.ones((6,6), dtype=bool)

    res = (indice[ np.newaxis,:] & identity_matrix) & (indice[:, np.newaxis] & identity_matrix)

    sous_mat_elem_1 = list()
    list_array      = list()
    for i in range(6):
        for j in range(6):
            if res[i,j] == True:
                list_array.append(mat_elem_global[i,j])
        
        if res[i,:].any() == True:
            sous_mat_elem_1.append(np.asarray(list_array))
            list_array = list()

    sous_mat_elem_1 = np.asarray(sous_mat_elem_1)
    
    #valeur different de zeros
    mask = LM != 0

    sous_indice =  LM[:,element][mask[:,element]]
    sous_indice =  sous_indice - np.ones_like(sous_indice)
    indice = list(sous_indice)

    temp_i, temp_j = 0, 0
    for i in indice:
        for j in indice:
            K_global[i,j] = K_global[i,j] + sous_mat_elem_1[temp_i, temp_j]
            temp_j = temp_j +1
        temp_j = 0
        temp_i = temp_i + 1
    return K_global


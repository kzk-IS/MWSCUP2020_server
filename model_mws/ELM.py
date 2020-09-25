import numpy as np
import h5py
import tensorflow as tf
import tensorflowjs as tfjs
import json
import math
class ExtremeLearningMachine(object):
    def __init__(self, n_unit, activation=None):
        self._activation = self._sig if activation is None else activation
        self._n_unit = n_unit

    @staticmethod
    def _sig(x):
        return 1. / (1 + np.exp(-x))

    @staticmethod
    def _add_bias_hstack(x):
        return np.hstack((x, np.ones((x.shape[0], 1))))


    @staticmethod
    def _add_bias_vstack(x):
        return np.vstack((x, np.ones((x.shape[1]))))


    def get_W0(self):
        return self.W0


    def get_W1(self):
        return self.W1


    def fit(self, X, y):
        self.W0 = np.random.random((X.shape[1], self._n_unit))
        X_add_bias = self._add_bias_hstack(X)
        w0_add_bias = self._add_bias_vstack(self.W0)

        z = self._activation(X_add_bias.dot(w0_add_bias))
        self.W1 = np.linalg.lstsq(z, y)[0]

    def transform(self, X):
        if not hasattr(self, 'W0'):
            raise UnboundLocalError('must fit before transform')
        X_add_bias = self._add_bias_hstack(X)
        w0_add_bias = self._add_bias_vstack(self.W0)
        z = self._activation(X_add_bias.dot(w0_add_bias))
        return z.dot(self.W1)

    def fit_transform(self, X, y):
        self.W0 = np.random.random((X.shape[1], self._n_unit))
        z = self._add_bias(self._activation(X.dot(self.W0)))
        self.W1 = np.linalg.lstsq(z, y)[0]
        return z.dot(self.W1)


def ELM2nn(w0,beta,bias,model):
    l1 = model.layers[0]
    l1.set_weights([w0,bias])
    l2 = model.layers[1]
    l2.set_weights(beta)
    return model

# rand_w0 = np.arange(1,101).reshape(10,10)
# rand_bias = np.arange(1,11)
# weights_list = [rand_w0,rand_bias]
# print(weights_list)
# l1 = model.layers[0]
# l1.set_weights(weights_list)
# print(l1.get_weights())



from sklearn import datasets


def make_iris():
    iris = datasets.load_iris()
    ind = np.random.permutation(len(iris.data))

    y = np.zeros((len(iris.target), 3))
    y[np.arange(len(y)), iris.target] = 1

    acc_train = []
    acc_test = []
    N = [10]
    for n in N:
        elm = ExtremeLearningMachine(n)
        elm.fit(iris.data[ind[:100]], y[ind[:100]])
        acc_train.append(np.average(np.argmax(elm.transform(iris.data[ind[:100]]), axis=1) == iris.target[ind[:100]]))
        acc_test.append(np.average(np.argmax(elm.transform(iris.data[ind[100:]]), axis=1) == iris.target[ind[100:]]))
    print(acc_train)
    print(acc_test)
    weight_beta = elm.get_W1()
    weight_w0 = np.array(elm.get_W0())
    weight_bias = np.array([1 for i in range(10)])
    model = ELM2nn(weight_w0,[weight_beta],weight_bias,model)
    return model


def make_label(label):
    if label:
        return [0,1]
    else:
        return [1,0]


def split_dataset(data):
    x_data,y_data,feature_names = make_dataset(data)
    ind = np.random.permutation(len(data))
    x_train = x_data[ind[:800]]
    y_train = y_data[ind[:800]]
    x_test = x_data[ind[800:]]
    y_test = y_data[ind[800:]]
    return x_train,y_train,x_test,y_test,feature_names
    #benign_dic.update(malware_dic)
    #total_num = len(benign_dic)
    #assert(total_num == b_num+m_num)
    #ind = np.random.permutation(b_num)


def make_dataset(data):
    x_data = []
    y_data = []
    for domain,features in data.items():
        feature_names = list(features.keys())
        tmp_x = list(features.values())[1:]
        tmp_y = make_label(features["isMaliciousSite"])
        x_data.append(tmp_x)
        y_data.append(tmp_y)
    x_data = np.array(x_data)
    y_data = np.array(y_data)
    #print(x_data.astype(np.float64),y_data.astype(np.float64))
    return x_data.astype(np.float64),y_data.astype(np.float64),np.array(feature_names)


def standard_trans(x_train,x_test):
    from sklearn.preprocessing import StandardScaler
    stdsc = StandardScaler()
    x_train_std = stdsc.fit_transform(x_train)
    #print(stdsc.mean_,stdsc.var_)
    x_test_std = stdsc.fit_transform(x_test)
    return x_train_std,x_test_std,(stdsc.mean_,stdsc.var_)


def To_json_parameter(mean,std,feature_names):
    parameter_dic = {}
    for m,s,fn in zip(mean,std,feature_names[1:]):
        parameter_dic[fn] = (m,math.sqrt(s))
    #print(parameter_dic)
    with open("./parameter.json","w") as f:
        json.dump(parameter_dic,f)


def update_data(b_x_data,m_x_data,b_y_data,m_y_data):
    print(b_x_data.shape,m_x_data.shape,b_y_data.shape,m_y_data.shape)
    x_data = np.concatenate([b_x_data,m_x_data])
    y_data = np.concatenate([b_y_data,m_y_data])
    return x_data,y_data


def make_model_for_mws(benign_data,malware_data,m_neuron):
    acc_train = []
    acc_test = []
    #benign data split
    b_x_training_data,b_y_training_data,b_x_test_data,b_y_test_data,feature_names = split_dataset(benign_data)
    #malware data split
    m_x_training_data,m_y_training_data,m_x_test_data,m_y_test_data, _ = split_dataset(malware_data)
    #union benign and malware for training
    x_training_data,y_training_data = update_data(b_x_training_data,m_x_training_data,b_y_training_data,m_y_training_data)
    #union benign and malware for test
    x_test_data,y_test_data = update_data(b_x_test_data,m_x_test_data,b_y_test_data,m_y_test_data)
    #standard transform
    x_training_data,x_test_data,(mean,std) = standard_trans(x_training_data,x_test_data)
    #mean and std to csv
    To_json_parameter(mean,std,feature_names)
    #training

    elm = ExtremeLearningMachine(m_neuron)
    elm.fit(x_training_data,y_training_data)
    #accuracy for training and test
    acc_train.append(np.average(np.argmax(elm.transform(x_training_data), axis=1) == np.argmax(y_training_data,axis=1)))
    acc_test.append(np.average(np.argmax(elm.transform(x_test_data), axis=1) == np.argmax(y_test_data,axis=1)))
    print("acc for training = ",acc_train)
    print("acc for test =",acc_test)
    #make neural network
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(m_neuron, name='L1_dense',input_shape=(9,),activation="sigmoid"),
        tf.keras.layers.Dense(2, name='output',use_bias=False)
    ])
    #From ELM to Neural Network

    weight_beta = elm.get_W1()
    weight_w0 = np.array(elm.get_W0())
    weight_bias = np.array([1 for i in range(m_neuron)])
    nn_model = ELM2nn(weight_w0,[weight_beta],weight_bias,model)
    return nn_model


def merge_data(data_dic):
    merged_dic={}
    for index in data_dic.keys():
        merged_dic.update(data_dic[index])
    return merged_dic

benign_data_dic = {}
malware_data_dic = {}

for index in [1,2,3,4,5]:
    with open("./data/benign_output/benign_output{}.json".format(index)) as f:
        benign_data_dic[index] = json.load(f)
    with open("./data/malicious_output/malicious_output{}.json".format(index)) as f:
        malware_data_dic[index] = json.load(f)

benign_data = merge_data(benign_data_dic)
malware_data = merge_data(malware_data_dic)

middle_neurons = 100
model_after_training = make_model_for_mws(benign_data=benign_data,malware_data=malware_data,m_neuron=middle_neurons)

# model.compile(optimizer='adam',
#                 loss='sparse_categorical_crossentropy',
#                 metrics=['accuracy'])
#model.save("model_iris.h5")
tfjs.converters.save_keras_model(model_after_training,"model_mws")
model_after_training.summary()

from flask import Flask, jsonify, request
import pandas as pd
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS

# Load Excel file
df = pd.read_excel('sivalayam.xlsx')

@app.route('/categories', methods=['GET'])
def get_categories():
    categories = df['Subcategory'].unique().tolist()
    return jsonify(categories)

@app.route('/data/<category>', methods=['GET'])
def get_data(category):
    filtered_df = df[df['Subcategory'] == category]
    data = filtered_df.to_dict(orient='records')
    return jsonify(data)

@app.route('/update', methods=['POST'])
def update_data():
    data = request.json
    index = data['index']
    df.at[index, 'Description'] = data['description']
    df.at[index, 'Price'] = data['price']
    df.to_excel('data.xlsx', index=False)
    return jsonify({'message': 'Data updated successfully'})

@app.route('/delete', methods=['POST'])
def delete_data():
    data = request.json
    index = data['index']
    df.drop(index, inplace=True)
    df.to_excel('data.xlsx', index=False)
    return jsonify({'message': 'Data deleted successfully'})

if __name__ == '__main__':
    app.run(port=8032, debug=True)

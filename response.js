const response = (res, statusCode = 200, success = false, message = '', data = {}) => {
    return res.status(statusCode).json({
        success,
        message,
        data,
    })
}

export default response

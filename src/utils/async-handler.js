// a higher order function is a function that takes a function as an argument and returns another function
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise
            .resolve(requestHandler(req, res, next))
            .catch((err) => next(err));
    };
}


export { asyncHandler };